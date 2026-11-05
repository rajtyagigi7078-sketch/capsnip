"""Convert media that Chromium cannot decode into a local WebM preview proxy."""
import argparse
import json
import os
import sys


def make_proxy(source, destination):
    import av

    with av.open(source) as input_container:
        source_video = next((stream for stream in input_container.streams if stream.type == "video"), None)
        if source_video is None:
            raise ValueError("The selected file has no video stream.")

        os.makedirs(os.path.dirname(destination), exist_ok=True)
        with av.open(destination, mode="w", format="webm") as output_container:
            output_video = output_container.add_stream("libvpx", rate=source_video.average_rate or 30)
            output_video.width = source_video.codec_context.width
            output_video.height = source_video.codec_context.height
            output_video.pix_fmt = "yuv420p"
            output_video.options = {"deadline": "realtime", "cpu-used": "5", "crf": "32", "b": "0"}

            source_audio = next((stream for stream in input_container.streams if stream.type == "audio"), None)
            output_audio = output_container.add_stream("libopus", rate=48000) if source_audio else None
            resampler = av.AudioResampler(format="s16", layout="stereo", rate=48000) if source_audio else None

            for packet in input_container.demux(source_video, *([source_audio] if source_audio else [])):
                if packet.stream.type == "video":
                    for frame in packet.decode():
                        frame = frame.reformat(format="yuv420p")
                        for encoded in output_video.encode(frame):
                            output_container.mux(encoded)
                elif packet.stream.type == "audio" and output_audio and resampler:
                    for frame in packet.decode():
                        for converted in resampler.resample(frame):
                            for encoded in output_audio.encode(converted):
                                output_container.mux(encoded)

            for encoded in output_video.encode():
                output_container.mux(encoded)
            if output_audio:
                for converted in resampler.resample(None):
                    for encoded in output_audio.encode(converted):
                        output_container.mux(encoded)
                for encoded in output_audio.encode():
                    output_container.mux(encoded)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    try:
        make_proxy(args.input, args.output)
        print(json.dumps({"ready": True, "path": args.output}))
        return 0
    except Exception as error:
        print(json.dumps({"error": str(error)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
