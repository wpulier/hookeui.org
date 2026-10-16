"""Outline the researcher and her microscope in the photo with EdgeTAM (the app's own click model), from a few clicks."""
import sys, glob, numpy as np, torch
from PIL import Image
from transformers import EdgeTamModel, Sam2Processor

src, out = sys.argv[1], sys.argv[2]
snap = sorted(glob.glob(f"{__import__('os').path.expanduser('~')}/.cache/huggingface/hub/models--yonigozlan--EdgeTAM-hf/snapshots/*"))[-1]
proc = Sam2Processor.from_pretrained(snap, local_files_only=True)
model = EdgeTamModel.from_pretrained(snap, local_files_only=True).eval()
img = Image.open(src).convert("RGB")
W, H = img.size

def segment(box, pos, neg):
    pts = [[list(map(float, p)) for p in pos + neg]]
    labels = [[1] * len(pos) + [0] * len(neg)]
    inputs = proc(images=img, input_boxes=[[box]], input_points=[pts], input_labels=[labels], return_tensors="pt")
    with torch.inference_mode():
        o = model(**inputs, multimask_output=True)
    masks = proc.post_process_masks(o.pred_masks, inputs["original_sizes"])[0][0]
    scores = o.iou_scores[0, 0]
    i = int(scores.argmax())
    print("score", [round(float(s), 3) for s in scores])
    return masks[i].numpy().astype(bool)

# Her: hair, face, shoulder, the patterned sleeve, the hand on the bench.
person = segment([880, 190, 1990, 1523], [[1100, 330], [1180, 640], [1450, 700], [1700, 1100], [1250, 1330], [1600, 1400], [1400, 900]], [[1700, 300], [600, 700], [1150, 1450], [960, 1390]])
# The microscope: tube, arm, objectives, stage, foot.
scope = segment([980, 690, 1310, 1290], [[1090, 760], [1100, 900], [1220, 900], [1050, 1050], [1150, 1110], [1170, 1250], [1030, 1010], [1250, 1100]], [[700, 1000], [1250, 700], [900, 1050], [950, 1200], [1000, 1270], [980, 880]])
import scipy.ndimage as ndi
scope = ndi.binary_opening(scope, iterations=2)
lab, n = ndi.label(scope)
if n > 1:
    sizes = ndi.sum(scope, lab, range(1, n + 1)); scope = lab == (1 + int(np.argmax(sizes)))
scope = ndi.binary_fill_holes(scope) & scope | ndi.binary_closing(scope, iterations=2)
import scipy.ndimage as ndi
lab, n = ndi.label(person)
if n > 1:
    sizes = ndi.sum(person, lab, range(1, n + 1)); person = lab == (1 + int(np.argmax(sizes)))
m = person | scope
print("person", person.mean().round(3), "scope", scope.mean().round(3))
Image.fromarray((m * 255).astype(np.uint8)).save(out + "/mask.png")
Image.fromarray((person * 255).astype(np.uint8)).save(out + "/person.png")
Image.fromarray((scope * 255).astype(np.uint8)).save(out + "/scope.png")
rgba = np.dstack([np.array(img), (m * 255).astype(np.uint8)])
Image.fromarray(rgba).save(out + "/cut.png")
