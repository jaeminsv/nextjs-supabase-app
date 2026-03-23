# Korean Font for PDF Export

Place `NanumGothic.ttf` in this directory to enable Korean text rendering in PDF exports.

## Download

Download from Google Fonts:
https://fonts.google.com/specimen/Nanum+Gothic

Or from Naver:
https://hangeul.naver.com/font

## Usage

The file is automatically loaded at runtime by `lib/utils/pdf.ts` when a PDF is generated.
If the file is missing, PDF generation continues with the default Latin font (Korean characters will not render correctly).
