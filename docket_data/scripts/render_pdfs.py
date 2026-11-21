#!/usr/bin/env python3
"""Docket — render data/docs_src/*.md → data/docs/*.pdf (and the 3 held-out contracts).

Libraries: reportlab (text PDFs), pdftoppm (poppler) + Pillow + numpy (image-only scans).
Rendering by document kind:
  contract  — A4 text PDF, running header with the doc title, "Page x of y", signature page
  docusign  — as contract + "DocuSign Envelope ID" line on every page + final Certificate of Completion page
  draft     — as contract + diagonal DRAFT watermark, tracked changes in colour, comments highlighted
  email     — email printout: From/To/Cc/Date/Subject/Attachments header box, then body
  scan      — IMAGE-ONLY PDF (no text layer): rendered, rasterised, rotated, speckled, stamped

Usage: python3 scripts/render_pdfs.py   (run from repo root)
"""
import json, os, random, re, subprocess, tempfile

import numpy as np
import pdfplumber
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.platypus import (HRFlowable, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table,
                                TableStyle)

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
FONT_DIR = "/usr/share/fonts/truetype/dejavu"
for name, f in [("Sans", "DejaVuSans.ttf"), ("Sans-Bold", "DejaVuSans-Bold.ttf"), ("Sans-Oblique", "DejaVuSans-Oblique.ttf"),
                ("Sans-BoldOblique", "DejaVuSans-BoldOblique.ttf"), ("Serif", "DejaVuSerif.ttf"), ("Serif-Bold", "DejaVuSerif-Bold.ttf"),
                ("Serif-Italic", "DejaVuSerif-Italic.ttf")]:
    pdfmetrics.registerFont(TTFont(name, os.path.join(FONT_DIR, f)))
pdfmetrics.registerFontFamily("Sans", normal="Sans", bold="Sans-Bold", italic="Sans-Oblique", boldItalic="Sans-BoldOblique")
pdfmetrics.registerFontFamily("Serif", normal="Serif", bold="Serif-Bold", italic="Serif-Italic", boldItalic="Serif-Bold")

DRAFTS = {"DOC-07", "DOC-17", "HO-17"}
SCANS = {"DOC-12", "HO-18"}
EMAIL_HDR = re.compile(r"^\*\*(From|To|Cc|Date|Subject|Attachment|Attachments):\*\*\s*(.*)$")


def styles(family):
    b = 10.4 if family == "Sans" else 10
    return {
        "title": ParagraphStyle("t", fontName=f"{family}-Bold", fontSize=15, leading=19, alignment=TA_CENTER, spaceAfter=8, spaceBefore=4),
        "h2": ParagraphStyle("h2", fontName=f"{family}-Bold", fontSize=11, leading=14, spaceBefore=9, spaceAfter=4),
        "body": ParagraphStyle("b", fontName=family, fontSize=b, leading=b * 1.38, spaceAfter=5),
        "cell": ParagraphStyle("c", fontName=family, fontSize=b - 1, leading=(b - 1) * 1.3),
        "small": ParagraphStyle("s", fontName=family, fontSize=8, leading=10, textColor=colors.HexColor("#444444")),
        "cert": ParagraphStyle("cert", fontName="Sans", fontSize=9.5, leading=14),
    }


def inline(t):
    t = t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    t = re.sub(r"\[\+ (.+?) \+\]", r'<font color="#1d4ed8"><u>\1</u></font>', t)
    t = re.sub(r"\[- (.+?) -\]", r'<font color="#b91c1c"><strike>\1</strike></font>', t)
    t = re.sub(r"\[(Comment [^\]]+)\]", r'<font backColor="#fde68a">[\1]</font>', t)
    t = re.sub(r"\[(Placeholder[^\]]+)\]", r'<font backColor="#fde68a">[\1]</font>', t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<i>\1</i>", t)
    return t


def parse_table(lines, st, width):
    rows = [[c.strip() for c in l.strip().strip("|").split("|")] for l in lines]
    rows = [r for r in rows if not all(re.fullmatch(r":?-{2,}:?", c) for c in r if c)]
    n = max(len(r) for r in rows)
    rows = [r + [""] * (n - len(r)) for r in rows]
    data = [[Paragraph(inline(c), st["cell"]) for c in r] for r in rows]
    t = Table(data, colWidths=[width / n] * n, repeatRows=1)
    t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#9ca3af")),
                           ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef2f7")),
                           ("VALIGN", (0, 0), (-1, -1), "TOP"),
                           ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]))
    return t


def md_to_flowables(md, st, width, kind):
    lines = md.splitlines()
    hr_idx = [i for i, l in enumerate(lines) if l.strip() == "---"]
    sig_break = hr_idx[-1] if (hr_idx and kind in ("contract", "docusign", "draft", "scan")) else None
    if sig_break is None and kind in ("contract", "docusign", "draft"):
        w = [i for i, l in enumerate(lines) if l.startswith("IN WITNESS")]
        sig_break = w[-1] if w else None
    out, buf, i = [], [], 0

    def flush():
        if buf:
            out.append(Paragraph("<br/>".join(inline(x) for x in buf), st["body"]))
            buf.clear()

    while i < len(lines):
        l = lines[i]
        s = l.strip()
        if i == sig_break and kind != "scan":
            flush()
            out.append(PageBreak())
            if s == "---":
                i += 1
                continue
        if s.startswith("**Certificate Of Completion**"):
            flush()
            cert = [s]
            i += 1
            while i < len(lines) and lines[i].strip():
                cert.append(lines[i].strip())
                i += 1
            out.append(PageBreak())
            out.append(Paragraph("Certificate Of Completion", st["title"]))
            body = "<br/><br/>".join(inline(c.replace("**Certificate Of Completion**", "").strip(" —")) for c in cert if c.replace("**Certificate Of Completion**", "").strip(" —"))
            box = Table([[Paragraph(body, st["cert"])]], colWidths=[width])
            box.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#1f2937")),
                                     ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                                     ("TOPPADDING", (0, 0), (-1, -1), 12), ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
                                     ("LEFTPADDING", (0, 0), (-1, -1), 12)]))
            out.append(box)
            out.append(Spacer(1, 8))
            out.append(Paragraph("This certificate was generated by the electronic signature service and records the signing events for the envelope above.", st["small"]))
            continue
        if not s or s.startswith("<!--"):
            flush()
        elif s.startswith("# "):
            flush()
            out.append(Paragraph(inline(s[2:]), st["title"]))
        elif s.startswith("## "):
            flush()
            out.append(Paragraph(inline(s[3:]), st["h2"]))
        elif s == "---":
            flush()
            out.append(HRFlowable(width="100%", thickness=0.6, color=colors.HexColor("#9ca3af"), spaceBefore=4, spaceAfter=6))
        elif s.startswith("--- Attachment:"):
            flush()
            out.append(Spacer(1, 6))
            out.append(HRFlowable(width="100%", thickness=1.2, color=colors.HexColor("#374151")))
            out.append(Paragraph("<b>" + inline(s.strip("- ").strip()) + "</b>", st["small"]))
            out.append(Spacer(1, 4))
        elif s.startswith("|"):
            flush()
            tl = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                tl.append(lines[i])
                i += 1
            out.append(parse_table(tl, st, width))
            out.append(Spacer(1, 6))
            continue
        else:
            buf.append(s)
        i += 1
    flush()
    return out


def email_header(md, st, width):
    """Split leading **From:** … header lines into a printout box. Returns (flowables, rest_md, subject)."""
    lines = md.splitlines()
    rows, attach, j = [], [], 0
    while j < len(lines) and EMAIL_HDR.match(lines[j].strip()):
        m = EMAIL_HDR.match(lines[j].strip())
        (attach.append(m.group(2)) if m.group(1).startswith("Attachment") else rows.append((m.group(1), m.group(2))))
        j += 1
    if attach:
        rows.append(("Attachments", "; ".join(attach)))
    subject = dict(rows).get("Subject", "Email")
    data = [[Paragraph(f"<b>{k}:</b>", st["cell"]), Paragraph(inline(v), st["cell"])] for k, v in rows]
    t = Table(data, colWidths=[28 * mm, width - 28 * mm])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f3f4f6")),
                           ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#9ca3af")),
                           ("VALIGN", (0, 0), (-1, -1), "TOP")]))
    head = [Paragraph("Velora Mail — printed message", st["small"]), Spacer(1, 3), t, Spacer(1, 10)]
    return head, "\n".join(lines[j:]), subject


def make_canvas(title, envelope, draft, label, plain=False):
    class NumberedCanvas(rl_canvas.Canvas):
        def __init__(self, *a, **k):
            super().__init__(*a, **k)
            self._saved = []

        def showPage(self):
            self._saved.append(dict(self.__dict__))
            self._startPage()

        def save(self):
            n = len(self._saved)
            for state in self._saved:
                self.__dict__.update(state)
                self._decorate(n)
                super().showPage()
            super().save()

        def _decorate(self, total):
            w, h = A4
            if plain:  # scans carry only what was on the paper
                return
            self.saveState()
            if draft:
                self.setFont("Sans-Bold", 96)
                self.setFillColor(colors.Color(0.85, 0.1, 0.1, alpha=0.13))
                self.translate(w / 2, h / 2)
                self.rotate(40)
                self.drawCentredString(0, -30, "DRAFT")
                self.rotate(-40)
                self.translate(-w / 2, -h / 2)
            self.setFillColor(colors.HexColor("#4b5563"))
            self.setFont("Sans", 7.5)
            top = h - 12 * mm
            if envelope:
                self.drawString(18 * mm, h - 8 * mm, f"DocuSign Envelope ID: {envelope}")
            self.drawString(18 * mm, top, title[:95])
            self.drawRightString(w - 18 * mm, top, "DRAFT — NOT FOR SIGNATURE" if draft else label)
            self.setStrokeColor(colors.HexColor("#d1d5db"))
            self.line(18 * mm, top - 2.5 * mm, w - 18 * mm, top - 2.5 * mm)
            self.drawCentredString(w / 2, 10 * mm, f"Page {self._pageNumber} of {total}")
            self.restoreState()
    return NumberedCanvas


def render_text_pdf(md, out_path, doc_key, kind, family="Sans"):
    st = styles(family)
    width = A4[0] - 36 * mm
    envelope = None
    first = md.splitlines()[0] if md else ""
    m = re.match(r"DocuSign Envelope ID: ([0-9A-F-]{36})", first)
    if m:
        envelope = m.group(1)
        md = "\n".join(md.splitlines()[1:])
        if "(Document" in first:
            md = first[first.index("("):].strip() + "\n\n" + md
    head = []
    if kind == "email":
        head, md, title = email_header(md, st, width)
    else:
        t = re.search(r"^# (.+)$", md, re.M)
        title = re.sub(r"\*", "", t.group(1)) if t else doc_key
    flow = head + md_to_flowables(md, st, width, kind)
    doc = SimpleDocTemplate(out_path, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=22 * mm,
                            bottomMargin=18 * mm, title=title, author="Velora Consumer Pvt Ltd — document store", subject=doc_key)
    doc.build(flow, canvasmaker=make_canvas(title, envelope, kind == "draft", "CONFIDENTIAL" if kind != "email" else "", plain=kind == "scan"))


# ---------------------------------------------------------------- image-only scans
def _stamp(img, text_top, text_bottom, center, r, color):
    d = ImageDraw.Draw(img)
    x, y = center
    for k in range(3):
        d.ellipse([x - r + k, y - r + k, x + r - k, y + r - k], outline=color)
    d.ellipse([x - r * 0.62, y - r * 0.62, x + r * 0.62, y + r * 0.62], outline=color, width=2)
    f = ImageFont.truetype(os.path.join(FONT_DIR, "DejaVuSans-Bold.ttf"), int(r * 0.17))
    for txt, dy in ((text_top, -0.8), (text_bottom, 0.72)):
        tw = d.textlength(txt, font=f)
        d.text((x - tw / 2, y + dy * r - r * 0.09), txt, fill=color, font=f)
    f2 = ImageFont.truetype(os.path.join(FONT_DIR, "DejaVuSans-Bold.ttf"), int(r * 0.24))
    d.text((x - d.textlength("BENGALURU", font=f2) / 2, y - r * 0.13), "BENGALURU", fill=color, font=f2)


def _signature(img, origin, seed, color=(70, 80, 150)):
    """Light pen scribble drawn just ABOVE the signature line so it does not hide typed text."""
    rnd = random.Random(seed)
    d = ImageDraw.Draw(img)
    x0, y0 = origin
    pts = [(x0 + k * 2.4, y0 + 6 * np.sin(k / 2.6 + rnd.random()) + rnd.uniform(-2, 2)) for k in range(34)]
    d.line(pts, fill=color, width=2, joint="curve")


def render_scan_pdf(md, out_path, doc_key, seed, stamp_text):
    with tempfile.TemporaryDirectory() as td:
        tmp = os.path.join(td, "t.pdf")
        render_text_pdf(md, tmp, doc_key, "scan", family="Serif")
        subprocess.run(["pdftoppm", "-r", "130", "-gray", "-png", tmp, os.path.join(td, "p")], check=True)
        scale = 130 / 72
        marks = {}
        with pdfplumber.open(tmp) as pdf:            # where the paper had signatures / seals
            for n, pg in enumerate(pdf.pages):
                for wd in pg.extract_words():
                    t = wd["text"].lower()
                    if "[signature]" in t:
                        marks.setdefault(n, []).append((wd["x0"], wd["top"], "signature"))
                    elif t.startswith("[company") or t.startswith("seal"):
                        marks.setdefault(n, []).append((wd["x0"], wd["top"], "stamp"))
            if not any(m[2] == "stamp" for v in marks.values() for m in v):   # no seal marker → seal near last signature
                last = max(marks) if marks else len(pdf.pages) - 1
                x, y, _ = (marks.get(last) or [(300, 600, "")])[-1]
                marks.setdefault(last, []).append((x + 120, y - 10, "stamp"))
        pages = sorted(p for p in os.listdir(td) if p.startswith("p") and p.endswith(".png"))
        rnd = random.Random(seed)
        imgs = []
        for n, p in enumerate(pages):
            im = Image.open(os.path.join(td, p)).convert("L")
            arr = np.asarray(im).astype(np.float32)
            rng = np.random.default_rng(seed * 100 + n)
            arr = arr * rng.uniform(0.93, 0.97) + 6                          # paper tone
            arr += rng.normal(0, 7, arr.shape)                               # grain
            speck = rng.random(arr.shape)
            arr[speck < 0.0016] = rng.uniform(20, 90)                        # dark speckles
            arr[(speck > 0.9993)] = 255
            h, w = arr.shape
            arr[:, :int(w * 0.012)] *= 0.72                                  # scanner edge shadow
            im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).convert("RGB")
            for k, (x, y, word) in enumerate(marks.get(n, [])):
                X, Y = int(x * scale), int(y * scale)
                if word == "signature":
                    _signature(im, (X, Y - 12), seed + n * 10 + k)
                else:   # seal in the right margin, level with the marker
                    _stamp(im, stamp_text[0], stamp_text[1], (int(w * 0.915), Y), int(w * 0.055), (40, 60, 150))
            im = im.rotate(rnd.uniform(-1.3, 1.3), resample=Image.BICUBIC, expand=False, fillcolor=(235, 235, 232))
            im = im.filter(ImageFilter.GaussianBlur(0.55)).convert("L")
            imgs.append(im)
        imgs[0].save(out_path, "PDF", save_all=True, append_images=imgs[1:], resolution=130)


# ---------------------------------------------------------------- driver
def kind_for(doc):
    if doc["doc_id"] in SCANS:
        return "scan"
    if doc["filename"].endswith(".eml"):
        return "email"
    if doc["doc_id"] in DRAFTS:
        return "draft"
    if doc["source"] == "docusign":
        return "docusign"
    return "contract"


def main():
    import sys
    only = set(sys.argv[1:])      # optional: render only these doc IDs (v3 re-renders just the changed docs)
    docs = json.load(open(os.path.join(ROOT, "documents.json"), encoding="utf-8"))
    os.makedirs(os.path.join(ROOT, "docs"), exist_ok=True)
    report = []
    for d in docs:
        if only and d["doc_id"] not in only:
            continue
        md = open(os.path.join(ROOT, "docs_src", f"{d['doc_id']}.md"), encoding="utf-8").read()
        out = os.path.join(ROOT, d["file"])
        k = kind_for(d)
        if k == "scan":
            render_scan_pdf(md, out, d["doc_id"], 12, ("CLEANSPHERE FACILITY", "SERVICES PVT LTD"))
        else:
            # the DOC-17 email carries a redline: render as an email printout with draft watermark
            if d["doc_id"] == "DOC-17":
                render_text_pdf_email_draft(md, out, d["doc_id"])
            else:
                render_text_pdf(md, out, d["doc_id"], k)
        report.append((d["doc_id"], k if d["doc_id"] != "DOC-17" else "email+draft"))
    for ho, k in (() if only else (("HO-16", "contract"), ("HO-17", "draft"), ("HO-18", "scan"))):
        md = open(os.path.join(ROOT, "gold", "heldout", f"{ho}.md"), encoding="utf-8").read()
        out = os.path.join(ROOT, "gold", "heldout", f"{ho}.pdf")
        if k == "scan":
            render_scan_pdf(md, out, ho, 18, ("KESTRELNET TELEMATICS", "PRIVATE LIMITED"))
        else:
            render_text_pdf(md, out, ho, k)
        report.append((ho, k))
    for r in report:
        print(f"  {r[0]:<7} {r[1]}")


def render_text_pdf_email_draft(md, out_path, doc_key):
    """Email printout whose attachment is an unsigned redline: email header + DRAFT watermark."""
    st = styles("Sans")
    width = A4[0] - 36 * mm
    head, rest, title = email_header(md, st, width)
    flow = head + md_to_flowables(rest, st, width, "email")
    doc = SimpleDocTemplate(out_path, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=22 * mm,
                            bottomMargin=18 * mm, title=title, subject=doc_key)
    doc.build(flow, canvasmaker=make_canvas(title, None, True, ""))


if __name__ == "__main__":
    main()
