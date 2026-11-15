#!/usr/bin/env python3
"""Build the website's 3D model of SoleSense from the hardware repository.

Reads the assembly-positioned reference meshes in
sole-sense/hardware/reference/ (millimetres, CAD axes: X along the device from
the handle heel to the filament tip, Z up) and writes one binary glTF with a
node per part. Each node carries `extras.group` (what moves together on the
page) and `extras.mat` (which material the page gives it). Normals are left
out; the page computes creased normals when it loads the file.

Usage:
    python3 scripts/build-model.py ../sole-sense public/models/solesense.raw.glb
    npx @gltf-transform/cli meshopt public/models/solesense.raw.glb public/models/solesense.glb

Only numpy is needed.
"""
import json
import struct
import sys
from pathlib import Path

import numpy as np

# part file stem -> (group, material). Anything not listed is left out:
# alternative cassettes 58/59, the bench cartridge, the assembly bridge, test
# coupons, the earlier spring-contact concept and the temporary service pin.
PARTS = {
    # Handle shell and the parts that ride on its upper half
    "01_Handle_Lower": ("handle_lower", "shell"),
    "02_Handle_Upper": ("handle_upper", "shell"),
    "30_OLED_096in_Retainer": ("handle_upper", "shell"),
    "12_Button_Cap": ("handle_upper", "teal"),
    "REF_OLED_096in_SSD1306": ("handle_upper", "oled"),
    "REF_Power_Slide_Switch": ("handle_upper", "black"),
    # Electronics inside the handle
    "03_Controller_Tray": ("internals", "tray"),
    "04_Charger_Tray": ("internals", "tray"),
    "05_SD_Tray": ("internals", "tray"),
    "14_Handle_Wire_Clamp": ("internals", "tray"),
    "20_Boost_Shelf": ("internals", "tray"),
    "29_Button_Platform": ("internals", "tray"),
    "REF_18650_67x18p6": ("internals", "battery"),
    "REF_ESP32_DevKit_38pin": ("internals", "pcb"),
    "REF_TP4056_USB_C_Protected": ("internals", "pcb_blue"),
    "REF_TPS61088_Boost_40x22": ("internals", "pcb_blue"),
    "REF_MicroSD_Mini_SPI": ("internals", "pcb"),
    "REF_Button_6x6x5": ("internals", "black"),
    "REF_Head_Harness_Dupont_1x4": ("internals", "wire"),
    # Twist-lock collar
    "32_Collar_Safety_Slider": ("collar", "teal"),
    "33_Captive_Collar_Right": ("collar", "teal"),
    "40_Captive_Collar_Left": ("collar", "teal"),
    # Pressure head housing
    "41_R04_Joint_Adaptor": ("head", "shell"),
    "42_Magnetic_Chassis": ("head", "shell"),
    "REF_Adaptor_Nut_1_1": ("head", "brass"),
    "REF_Adaptor_Nut_1_2": ("head", "brass"),
    "REF_Adaptor_Nut_2_1": ("head", "brass"),
    "REF_Adaptor_Nut_2_2": ("head", "brass"),
    "REF_Adaptor_Screw_1_1": ("head", "steel"),
    "REF_Adaptor_Screw_1_2": ("head", "steel"),
    "REF_Adaptor_Screw_2_1": ("head", "steel"),
    "REF_Adaptor_Screw_2_2": ("head", "steel"),
    # Removable cover
    "43_Removable_Lid": ("lid", "shell"),
    "56_Teal_Spine_Inlay": ("lid", "teal"),
    "REF_Lid_Nut_1_1": ("lid", "brass"),
    "REF_Lid_Nut_1_2": ("lid", "brass"),
    "REF_Lid_Nut_2_1": ("lid", "brass"),
    "REF_Lid_Nut_2_2": ("lid", "brass"),
    "REF_Lid_Screw_1_1": ("lid_screws", "steel"),
    "REF_Lid_Screw_1_2": ("lid_screws", "steel"),
    "REF_Lid_Screw_2_1": ("lid_screws", "steel"),
    "REF_Lid_Screw_2_2": ("lid_screws", "steel"),
    # The printed spring and the screws that hold its fixed rail
    "57_Printed_Flexure_080": ("cassette", "cassette"),
    "REF_Flexure_Fixed_Nut_1": ("cassette_fixed", "brass"),
    "REF_Flexure_Fixed_Nut_2": ("cassette_fixed", "brass"),
    "REF_Flexure_Fixed_Screw_1": ("cassette_fixed", "steel"),
    "REF_Flexure_Fixed_Screw_2": ("cassette_fixed", "steel"),
    # Everything that travels when the tip is pressed
    "44_Moving_Carriage": ("moving", "blue"),
    "46_Magnet_Retainer": ("moving", "blue"),
    "48_Locking_Filament_Cartridge": ("moving", "blue"),
    "51_Cartridge_Lock_Knob": ("moving", "teal"),
    "REF_Cartridge_Lock_M2x12": ("moving", "steel"),
    "REF_Magnet_Stack": ("magnet", "magnet"),
    "REF_Magnet_Nut_1": ("moving", "brass"),
    "REF_Magnet_Nut_2": ("moving", "brass"),
    "REF_Magnet_Screw_1": ("moving", "steel"),
    "REF_Magnet_Screw_2": ("moving", "steel"),
    "REF_Flexure_Moving_Nut_1": ("moving", "brass"),
    "REF_Flexure_Moving_Nut_2": ("moving", "brass"),
    "REF_Flexure_Moving_Screw_1": ("moving", "steel"),
    "REF_Flexure_Moving_Screw_2": ("moving", "steel"),
    "REF_Nylon_Unrated": ("filament", "filament"),
    # Stationary Hall sensor
    "47_Adjustable_Hall_Mount": ("sensor", "teal_dark"),
    "REF_49E_Hall_TO92S": ("sensor", "black"),
    "REF_Hall_Lead_1": ("sensor", "copper"),
    "REF_Hall_Lead_2": ("sensor", "copper"),
    "REF_Hall_Lead_3": ("sensor", "copper"),
    "REF_Sensor_Adjust_Screw_1": ("sensor", "steel"),
    "REF_Sensor_Adjust_Screw_2": ("sensor", "steel"),
    # The second head
    "10_Vibration_Head_Body": ("vibration", "shell"),
    "11_Vibration_Dome_Cap": ("vibration", "teal"),
    "REF_CoinMotor_10x2_Fafeicy": ("vibration", "steel"),
    "REF_Vibration_Driver_Reserve_6x20x10": ("vibration", "pcb"),
}


def load_stl(path: Path) -> np.ndarray:
    data = path.read_bytes()
    if data[:5] == b"solid" and b"facet" in data[:400]:
        raise SystemExit(f"{path.name}: ASCII STL is not supported")
    count = struct.unpack("<I", data[80:84])[0]
    dt = np.dtype([("n", "<3f4"), ("v", "<9f4"), ("a", "<u2")])
    return np.frombuffer(data, dtype=dt, count=count, offset=84)["v"].reshape(-1, 3)


def weld(tri_vertices: np.ndarray):
    """Merge coincident corners (to 0.001 mm) into an indexed mesh."""
    keys = np.round(tri_vertices.astype(np.float64) * 1000).astype(np.int64)
    uniq, inverse = np.unique(keys, axis=0, return_inverse=True)
    inverse = inverse.reshape(-1)
    tris = inverse.reshape(-1, 3)
    keep = (tris[:, 0] != tris[:, 1]) & (tris[:, 1] != tris[:, 2]) & (tris[:, 0] != tris[:, 2])
    return (uniq / 1000).astype(np.float32), tris[keep].reshape(-1)


def pad4(b: bytes, fill: bytes = b"\x00") -> bytes:
    return b + fill * ((4 - len(b) % 4) % 4)


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    ref = Path(sys.argv[1]) / "hardware" / "reference"
    out = Path(sys.argv[2])

    blob = bytearray()
    views, accessors, meshes, nodes = [], [], [], []

    def add_view(data: bytes, target: int) -> int:
        while len(blob) % 4:
            blob.append(0)
        views.append({"buffer": 0, "byteOffset": len(blob), "byteLength": len(data), "target": target})
        blob.extend(data)
        return len(views) - 1

    for stem, (group, mat) in PARTS.items():
        path = ref / f"{stem}.stl"
        if not path.exists():
            raise SystemExit(f"missing {path}")
        pos, idx = weld(load_stl(path))
        big = len(pos) > 65535
        idx_arr = idx.astype(np.uint32 if big else np.uint16)

        pv = add_view(pos.tobytes(), 34962)
        accessors.append({
            "bufferView": pv, "componentType": 5126, "count": int(len(pos)), "type": "VEC3",
            "min": pos.min(0).tolist(), "max": pos.max(0).tolist(),
        })
        pa = len(accessors) - 1
        iv = add_view(idx_arr.tobytes(), 34963)
        accessors.append({"bufferView": iv, "componentType": 5125 if big else 5123, "count": int(len(idx_arr)), "type": "SCALAR"})
        ia = len(accessors) - 1

        meshes.append({"name": stem, "primitives": [{"attributes": {"POSITION": pa}, "indices": ia}]})
        nodes.append({"name": stem, "mesh": len(meshes) - 1, "extras": {"group": group, "mat": mat}})
        print(f"{stem:40s} {group:15s} {mat:10s} verts={len(pos):6d} tris={len(idx) // 3:6d}")

    gltf = {
        "asset": {"version": "2.0", "generator": "solesense-web scripts/build-model.py"},
        "scene": 0,
        "scenes": [{"nodes": [len(nodes)]}],
        "nodes": nodes + [{"name": "SoleSense", "children": list(range(len(nodes))),
                           "extras": {"units": "mm", "axes": "X heel-to-tip, Z up"}}],
        "meshes": meshes,
        "accessors": accessors,
        "bufferViews": views,
        "buffers": [{"byteLength": len(blob)}],
    }
    js = pad4(json.dumps(gltf, separators=(",", ":")).encode(), b" ")
    bin_ = pad4(bytes(blob))
    total = 12 + 8 + len(js) + 8 + len(bin_)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(js), 0x4E4F534A) + js)
        f.write(struct.pack("<II", len(bin_), 0x004E4942) + bin_)
    print(f"wrote {out} ({total / 1024:.0f} KiB, {len(nodes)} parts)")


if __name__ == "__main__":
    main()
