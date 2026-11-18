"""Extract the supplied 4x4 WD atlas, preserving artwork and excluding captions."""
import argparse
from pathlib import Path
from PIL import Image, ImageOps

parser = argparse.ArgumentParser()
parser.add_argument('atlas', type=Path)
parser.add_argument('--output', type=Path, default=Path('dist/assets/item-icons'))
args = parser.parse_args()
atlas = Image.open(args.atlas).convert('RGB')
if atlas.size != (1448, 1086):
    raise ValueError('Expected the original 1448x1086 atlas')
names = ['melee', 'ranged', 'armor', 'implant', 'neurodeck', 'worm', 'demon',
         'grenade', 'medicine', 'stimulant', 'gadget', 'vehicle', 'ammo',
         'consumable', 'other', 'manual']
args.output.mkdir(parents=True, exist_ok=True)
contact = Image.new('RGB', (1024, 1024), '#0B0B10')
for index, name in enumerate(names):
    x = [165, 459, 753, 1047][index % 4]
    y = [85, 319, 553, 785][index // 4]
    fragment = atlas.crop((x, y, x + 238, y + 184))
    fragment = ImageOps.contain(fragment, (256, 256), Image.Resampling.LANCZOS)
    square = Image.new('RGB', (256, 256), '#0B0B10')
    square.paste(fragment, ((256-fragment.width)//2, (256-fragment.height)//2))
    square.save(args.output / (name + '.webp'), quality=90, method=6)
    contact.paste(square, ((index % 4)*256, (index // 4)*256))
contact.save(args.output.parent.parent.parent / 'item-icons-contact.png')
print('Extracted 16 square icons')
