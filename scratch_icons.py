"""Generate high quality PNG icons for SoundGuard PWA."""
import struct
import zlib
import os

def create_png(width, height, filename):
    # RGBA image buffer
    raw_data = bytearray()
    
    center_x = width / 2.0
    center_y = height / 2.0
    radius = width * 0.44

    for y in range(height):
        raw_data.append(0)  # Filter type none
        for x in range(width):
            dx = x - center_x
            dy = y - center_y
            dist = (dx*dx + dy*dy) ** 0.5
            
            # Rounded squircle background
            if dist < radius:
                # Radial gradient: Cyan #06b6d4 to dark blue #0e1726
                ratio = dist / radius
                r = int(6 + (14 - 6) * ratio)
                g = int(182 - 120 * ratio)
                b = int(212 - 70 * ratio)
                
                # Draw a shield / sound badge in center
                if abs(dx) < width * 0.22 and abs(dy) < height * 0.22:
                    # White/red center shield highlight
                    r = 255
                    g = 50
                    b = 80
                raw_data.extend([r, g, b, 255])
            else:
                # Transparent outside
                raw_data.extend([0, 0, 0, 0])

    compressed = zlib.compress(bytes(raw_data))

    def make_chunk(chunk_type, data):
        return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", zlib.crc32(chunk_type + data) & 0xffffffff)

    png_bytes = (
        b"\x89PNG\r\n\x1a\n" +
        make_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)) +
        make_chunk(b"IDAT", compressed) +
        make_chunk(b"IEND", b"")
    )

    with open(filename, "wb") as f:
        f.write(png_bytes)
    print(f"Generated {filename}")

if __name__ == "__main__":
    out_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "public")
    os.makedirs(out_dir, exist_ok=True)
    create_png(192, 192, os.path.join(out_dir, "icon-192.png"))
    create_png(512, 512, os.path.join(out_dir, "icon-512.png"))
