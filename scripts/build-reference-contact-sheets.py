"""Build one-second visual contact sheets for the supplied Capsnip reference clips."""
from pathlib import Path
import argparse
import json
import math
import re
import struct
import zlib

import av
import numpy as np

FONT = {
    "0": ("01110", "10001", "10011", "10101", "11001", "10001", "01110"),
    "1": ("00100", "01100", "00100", "00100", "00100", "00100", "01110"),
    "2": ("01110", "10001", "00001", "00010", "00100", "01000", "11111"),
    "3": ("11110", "00001", "00001", "01110", "00001", "00001", "11110"),
    "4": ("00010", "00110", "01010", "10010", "11111", "00010", "00010"),
    "5": ("11111", "10000", "10000", "11110", "00001", "00001", "11110"),
    "6": ("01110", "10000", "10000", "11110", "10001", "10001", "01110"),
    "7": ("11111", "00001", "00010", "00100", "01000", "01000", "01000"),
    "8": ("01110", "10001", "10001", "01110", "10001", "10001", "01110"),
    "9": ("01110", "10001", "10001", "01111", "00001", "00001", "01110"),
    ".": ("00000", "00000", "00000", "00000", "00000", "00110", "00110"),
    "s": ("00000", "00000", "01111", "10000", "01110", "00001", "11110"),
}


def png_bytes(rgb):
    height, width, _ = rgb.shape
    raw = b"".join(b"\0" + rgb[row].tobytes() for row in range(height))

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 4)) + chunk(b"IEND", b""))


def draw_text(image, text, x, y, color=(230, 239, 242), scale=2):
    for character in text:
        glyph = FONT.get(character)
        if glyph:
            for gy, row in enumerate(glyph):
                for gx, bit in enumerate(row):
                    if bit == "1":
                        image[y + gy * scale:y + (gy + 1) * scale,
                              x + gx * scale:x + (gx + 1) * scale] = color
        x += 6 * scale


def make_cell(rgb, seconds, width=180, height=180):
    cell = np.full((height, width, 3), (18, 22, 24), dtype=np.uint8)
    max_height = height - 23
    scale = min((width - 8) / rgb.shape[1], (max_height - 8) / rgb.shape[0])
    resized_width = max(1, int(rgb.shape[1] * scale))
    resized_height = max(1, int(rgb.shape[0] * scale))
    x_index = np.linspace(0, rgb.shape[1] - 1, resized_width).astype(np.int32)
    y_index = np.linspace(0, rgb.shape[0] - 1, resized_height).astype(np.int32)
    small = rgb[y_index[:, None], x_index[None, :]]
    left = (width - resized_width) // 2
    top = (max_height - resized_height) // 2
    cell[top:top + resized_height, left:left + resized_width] = small
    cell[max_height - 1:max_height + 1, :, :] = (52, 63, 67)
    draw_text(cell, f"{seconds:05.1f}s", 5, height - 18)
    return cell


def slug(value):
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default=r"C:\Users\yuvra\OneDrive\Desktop\captions")
    parser.add_argument("--output", default=str(Path(__file__).resolve().parents[1] / "reference-review" / "one-second-sheets"))
    parser.add_argument("--columns", type=int, default=8)
    parser.add_argument("--rows", type=int, default=5)
    args = parser.parse_args()

    source, output = Path(args.source), Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    clips = sorted(source.glob("*.mp4"), key=lambda path: path.name.lower())
    style_clips = [clip for clip in clips if not clip.name.startswith("screen-")]
    manifest = []
    if style_clips:
        manifest.append({"kind": "screen-recording", "file": next((c.name for c in clips if c.name.startswith("screen-")), None)})
    for index, clip in enumerate(style_clips, start=1):
        manifest.append({"kind": "caption-style-reference", "styleNumber": index, "file": clip.name})
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    cell_w = cell_h = 180
    page_size = args.columns * args.rows
    for item in manifest:
        clip = source / item["file"]
        slug_name = f"{item.get('styleNumber', 0):02d}-{slug(clip.stem)}" if item["kind"] == "caption-style-reference" else f"screen-{slug(clip.stem)}"
        with av.open(str(clip)) as container:
            stream = next(stream for stream in container.streams if stream.type == "video")
            rate = float(stream.average_rate or stream.base_rate or 30)
            duration = float(container.duration / av.time_base) if container.duration else float(stream.duration * stream.time_base)
            wanted = 0.0
            page_frames = []
            page = 1
            saved = 0
            previous = None

            def flush_page():
                nonlocal page_frames, page
                if not page_frames:
                    return
                sheet = np.full((args.rows * cell_h, args.columns * cell_w, 3), (7, 9, 10), dtype=np.uint8)
                for number, frame_cell in enumerate(page_frames):
                    row, column = divmod(number, args.columns)
                    y, x = row * cell_h, column * cell_w
                    sheet[y:y + cell_h, x:x + cell_w] = frame_cell
                target = output / f"{slug_name}-p{page:02d}.png"
                target.write_bytes(png_bytes(sheet))
                page_frames = []
                page += 1

            for frame in container.decode(stream):
                seconds = float(frame.time if frame.time is not None else frame.pts * stream.time_base)
                if seconds >= wanted and wanted <= duration:
                    chosen = frame
                    if previous and abs(previous[0] - wanted) < abs(seconds - wanted):
                        chosen = previous[1]
                    rgb = chosen.to_ndarray(format="rgb24")
                    page_frames.append(make_cell(rgb, wanted))
                    saved += 1
                    wanted += 1.0
                    if len(page_frames) == page_size:
                        flush_page()
                previous = (seconds, frame)
            if wanted < duration and previous:
                rgb = previous[1].to_ndarray(format="rgb24")
                page_frames.append(make_cell(rgb, wanted))
                saved += 1
            flush_page()
            print(json.dumps({"file": clip.name, "styleNumber": item.get("styleNumber"), "duration": round(duration, 2), "sampledFrames": saved, "pages": math.ceil(saved / page_size)}))


if __name__ == "__main__":
    main()
