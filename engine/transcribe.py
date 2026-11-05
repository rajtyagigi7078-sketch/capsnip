import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

def device_status():
    ram_gb = 0
    try:
        import ctypes
        class MemoryStatus(ctypes.Structure):
            _fields_ = [("dwLength", ctypes.c_ulong), ("dwMemoryLoad", ctypes.c_ulong),
                        ("ullTotalPhys", ctypes.c_ulonglong), ("ullAvailPhys", ctypes.c_ulonglong),
                        ("ullTotalPageFile", ctypes.c_ulonglong), ("ullAvailPageFile", ctypes.c_ulonglong),
                        ("ullTotalVirtual", ctypes.c_ulonglong), ("ullAvailVirtual", ctypes.c_ulonglong),
                        ("ullAvailExtendedVirtual", ctypes.c_ulonglong)]
        status = MemoryStatus(); status.dwLength = ctypes.sizeof(MemoryStatus)
        if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status)):
            ram_gb = round(status.ullTotalPhys / (1024 ** 3), 1)
    except Exception:
        pass

    cpu_model = "base" if ram_gb >= 8 else "tiny"
    # This release intentionally uses the CPU backend only. Do not select CUDA
    # just because an NVIDIA adapter is present: CUDA is no longer bundled.
    return {"ready": True, "device": "cpu", "deviceName": "CPU",
            "ramGb": ram_gb, "cpuThreads": os.cpu_count() or 4,
            "cpuModel": cpu_model, "gpuModel": cpu_model,
            "recommendedModel": cpu_model, "gpuAcceleration": False}


def romanize_hinglish(text):
    """Write Devanagari Hindi in readable Latin-script Hinglish; leave English intact."""
    devanagari = re.compile(r"[\u0900-\u097f]+")
    if not devanagari.search(text or ""):
        return text

    from indic_transliteration import sanscript

    def convert(match):
        roman = sanscript.transliterate(match.group(0), sanscript.DEVANAGARI, sanscript.ITRANS)
        roman = roman.replace("~N", "n").replace("~n", "n").replace(".N", "n")
        roman = roman.replace("eM", "ein")
        roman = roman.replace("M", "n").replace("Ch", "chh")
        roman = roman.replace("A", "aa").replace("I", "i").replace("U", "oo")
        roman = roman.lower()
        # Hindi's unmarked final schwa is normally not written in Roman Hinglish.
        roman = re.sub(r"a(?=$|[|।॥])", "", roman)
        return roman

    return devanagari.sub(convert, text).replace("|", ".")


def run_transcription(model, input_path, language, max_words=5, output_hinglish=False):
    prompt = (
        "Natural Indian speech with Hindi and English mixed. Preserve the spoken words without translating. "
        "Write Hindi in Latin-script Hinglish (for example, 'aap kaise ho') and keep English words in English."
        if output_hinglish else
        "This is natural speech and may switch between Hindi and English (Hinglish). Preserve the spoken language; do not translate."
    )
    segments, info = model.transcribe(input_path, language=language, initial_prompt=prompt,
                                      word_timestamps=True, vad_filter=True,
                                      condition_on_previous_text=True)
    result = []
    for segment in segments:
        words = []
        if segment.words:
            words = [{"text": w.word, "start": round(w.start, 3), "end": round(w.end, 3)} for w in segment.words]
        if not words:
            text = romanize_hinglish(segment.text.strip()) if output_hinglish else segment.text.strip()
            result.append({"start": round(segment.start, 3), "end": round(segment.end, 3), "text": text, "words": []})
            continue

        if output_hinglish:
            for word in words:
                word["text"] = romanize_hinglish(word["text"])

        # Turn Whisper's sentence-sized chunks into short, editable caption cards.
        chunk = []
        def flush_chunk():
            if not chunk:
                return
            text = " ".join(word["text"].strip() for word in chunk).strip()
            result.append({"start": chunk[0]["start"], "end": chunk[-1]["end"], "text": text,
                           "words": list(chunk)})
            chunk.clear()

        for word in words:
            if chunk:
                previous = chunk[-1]
                current_text = " ".join(item["text"].strip() for item in chunk)
                pause = word["start"] - previous["end"]
                punctuation_break = previous["text"].strip().endswith((",", ";", ":", ".", "!", "?"))
                length_break = len(current_text) + len(word["text"].strip()) + 1 > 34
                if pause > 0.55 or len(chunk) >= max_words or length_break or punctuation_break:
                    flush_chunk()
            chunk.append(word)
        flush_chunk()
    return result, info


def run_swift_hinglish(input_path, max_words=5):
    """Use Capsnip's bundled timestamped Swift Hinglish ASR with speech-only VAD windows."""
    from faster_whisper.audio import decode_audio
    from faster_whisper.vad import VadOptions, get_speech_timestamps

    helper = os.path.join(os.path.dirname(__file__), "swift-node", "swift_hinglish.mjs")
    model_dir = os.path.join(os.path.dirname(__file__), "swift-node", "node_modules", "@huggingface", "transformers", ".cache", "ishaan-g", "whisper-hinglish-swift_timestamped")
    model_files = ("config.json", "tokenizer.json", os.path.join("onnx", "encoder_model_quantized.onnx"), os.path.join("onnx", "decoder_model_merged_quantized.onnx"))
    missing = [name for name in model_files if not os.path.isfile(os.path.join(model_dir, name))]
    if missing:
        raise RuntimeError("The bundled Swift Hinglish model is incomplete: " + ", ".join(missing))
    if not os.path.isfile(helper):
        raise RuntimeError("The bundled Swift Hinglish transcription runtime is missing.")

    configured_node = os.environ.get("CAPSNIP_NODE") or os.environ.get("SNIP_AI_NODE")
    node_exe = configured_node if configured_node and os.path.isfile(configured_node) else shutil.which("node")
    if not node_exe:
        raise RuntimeError("The bundled Node runtime for Swift Hinglish transcription is unavailable.")

    print("Detecting speech regions for Hinglish transcription…", file=sys.stderr, flush=True)
    audio = decode_audio(input_path, sampling_rate=16000)
    duration = len(audio) / 16000
    vad_regions = get_speech_timestamps(
        audio,
        VadOptions(threshold=0.35, neg_threshold=0.20, min_speech_duration_ms=250,
                   max_speech_duration_s=25.0, min_silence_duration_ms=650, speech_pad_ms=250),
        sampling_rate=16000,
    )
    speech_regions = [{"start": round(region["start"] / 16000, 3), "end": round(region["end"] / 16000, 3)}
                      for region in vad_regions if region.get("end", 0) > region.get("start", 0)]
    if not speech_regions:
        return [], {"duration": duration, "device": "cpu", "model": "ishaan-g/whisper-hinglish-swift_timestamped", "speech_regions": 0}

    regions_path = output_path = audio_path = None
    try:
        with tempfile.NamedTemporaryFile(prefix="capsnip-speech-regions-", suffix=".json", mode="w", encoding="utf-8", delete=False) as stream:
            regions_path = stream.name
            json.dump(speech_regions, stream)
        with tempfile.NamedTemporaryFile(prefix="capsnip-swift-result-", suffix=".json", delete=False) as stream:
            output_path = stream.name
        with tempfile.NamedTemporaryFile(prefix="capsnip-swift-audio-", suffix=".f32le", delete=False) as stream:
            audio_path = stream.name
        audio.astype("<f4", copy=False).tofile(audio_path)

        worker_env = os.environ.copy()
        worker_env.setdefault("PYTHONUTF8", "1")
        worker_env.setdefault("PYTHONIOENCODING", "utf-8")
        print(f"Running timestamp-enabled Swift Hinglish ASR on {worker_env.get('SNIP_AI_SWIFT_DEVICE', 'cpu').upper()}…", file=sys.stderr, flush=True)
        process = subprocess.Popen([node_exe, helper, audio_path, output_path, regions_path],
                                   stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                                   encoding="utf-8", errors="replace", env=worker_env, bufsize=1)
        if process.stdout:
            for line in process.stdout:
                print(line.rstrip(), file=sys.stderr, flush=True)
        if process.wait() != 0:
            raise RuntimeError("Swift Hinglish transcription failed. Check the local ASR runtime and model files.")
        with open(output_path, "r", encoding="utf-8") as stream:
            swift_data = json.load(stream)

        words = []
        for chunk in swift_data.get("chunks", []):
            try:
                text = str(chunk.get("text", "")).strip()
                start, end = float(chunk["start"]), float(chunk["end"])
            except (TypeError, ValueError, KeyError, AttributeError):
                continue
            if text and 0 <= start < end <= duration + 0.05 and end - start <= 2.5:
                if words and text.casefold() == words[-1]["text"].casefold() and start - words[-1]["end"] <= 0.08:
                    continue
                words.append({"text": text, "start": round(start, 3), "end": round(end, 3)})

        segments, chunk = [], []
        def flush_chunk():
            if not chunk:
                return
            segments.append({"start": chunk[0]["start"], "end": chunk[-1]["end"],
                             "text": " ".join(word["text"] for word in chunk), "words": list(chunk)})
            chunk.clear()

        for word in words:
            if chunk:
                previous = chunk[-1]
                text_so_far = " ".join(item["text"] for item in chunk)
                pause = word["start"] - previous["end"]
                punctuation_break = previous["text"].endswith((",", ";", ":", ".", "!", "?"))
                length_break = len(text_so_far) + len(word["text"]) + 1 > 34
                if pause > 0.55 or len(chunk) >= max_words or length_break or punctuation_break:
                    flush_chunk()
            chunk.append(word)
        flush_chunk()
        return segments, {"duration": duration, "device": swift_data.get("device", "cpu"),
                          "model": "ishaan-g/whisper-hinglish-swift_timestamped", "speech_regions": len(speech_regions)}
    finally:
        for temporary_path in (regions_path, output_path, audio_path):
            if temporary_path:
                try:
                    os.unlink(temporary_path)
                except OSError:
                    pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--install-check", action="store_true")
    parser.add_argument("--input")
    parser.add_argument("--model", default="base")
    parser.add_argument("--cpu-model", choices=("tiny", "base", "small"), default="base")
    parser.add_argument("--language", default="auto")
    parser.add_argument("--device", default="auto")
    parser.add_argument("--threads", type=int, default=0)
    parser.add_argument("--download-root")
    args = parser.parse_args()

    if args.install_check:
        status = device_status()
        try:
            import faster_whisper  # noqa: F401
            status["ready"] = True
            status["engineInstalled"] = True
        except Exception as exc:
            status["ready"] = False
            status["engineInstalled"] = False
            status["message"] = f"faster-whisper is not installed: {exc}"
        print(json.dumps(status))
        return 0

    if args.check:
        status = device_status()
        try:
            import faster_whisper  # noqa: F401
            status["ready"] = True
            status["engineInstalled"] = True
        except Exception as exc:
            status["ready"] = False
            status["engineInstalled"] = False
            status["message"] = f"faster-whisper is not installed: {exc}"
        print(json.dumps(status))
        return 0

    if not args.input or not os.path.isfile(args.input):
        print(json.dumps({"error": "Choose an existing audio or video file first."}))
        return 2

    try:
        import av
        with av.open(args.input) as media:
            if not media.streams.audio:
                raise RuntimeError("This clip has no audio track to transcribe.")

        if args.language == "hinglish":
            print("Using Swift Hinglish ASR with word-level timestamps…", file=sys.stderr, flush=True)
            result, info = run_swift_hinglish(args.input)
            print(json.dumps({"segments": result, "language": "hinglish", "languageProbability": None,
                              "duration": round(float(info.get("duration") or 0), 3), "device": info.get("device", "cpu"),
                              "computeType": "q8", "model": info.get("model"), "fallbackReason": None}, ensure_ascii=False))
            return 0

        from faster_whisper import WhisperModel
        status = device_status()
        selected_device = "cpu"
        model_name = args.model
        cpu_model = args.cpu_model or status.get("cpuModel") or "base"
        thread_count = max(1, args.threads or min(8, os.cpu_count() or 4))
        compute_type = "int8"
        fallback_reason = None
        model_options = {"device": selected_device, "compute_type": compute_type,
                         "cpu_threads": thread_count}
        if args.download_root:
            os.makedirs(args.download_root, exist_ok=True)
            model_options["download_root"] = args.download_root
        print(f"Loading {model_name} on {selected_device} ({compute_type}, {thread_count} CPU threads)…", file=sys.stderr, flush=True)
        model = WhisperModel(model_name, **model_options)

        # Hinglish is code-switched; use automatic detection, then romanize only Hindi script.
        language = "en" if args.language == "english" else None
        output_hinglish = args.language == "hinglish"
        print("Transcribing speech and aligning words…", file=sys.stderr, flush=True)
        result, info = run_transcription(model, args.input, language, output_hinglish=output_hinglish)
        print(json.dumps({"segments": result, "language": info.language,
                          "languageProbability": round(float(info.language_probability or 0), 4),
                          "duration": round(float(info.duration or 0), 3), "device": selected_device,
                          "computeType": "int8",
                          "model": model_name, "fallbackReason": fallback_reason}, ensure_ascii=False))
        return 0
    except Exception as exc:
        print(json.dumps({"error": str(exc)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
