# Public Document Library

## Current State
Naya project hai, koi existing code nahi hai.

## Requested Changes (Diff)

### Add
- Ek public document repository website jaha koi bhi documents upload kar sake
- Documents publicly visible honge - koi bhi bina login ke dekh sake
- File upload feature: PDF, Word, images, aur other documents support
- Document listing page - saare uploaded documents grid/list view mein
- Document details page - file ka naam, description, upload date dikhaye
- Direct document download/view link
- Search functionality taaki log documents dhundh sake
- SEO-friendly pages taaki Google par search ho sake

### Modify
- Kuch nahi (naya project)

### Remove
- Kuch nahi (naya project)

## Implementation Plan
1. Blob storage component select karna file uploads ke liye
2. Backend mein document metadata store karne ke liye APIs banani: upload, list, get, delete
3. Frontend mein:
   - Home page with document grid listing
   - Upload page/modal with title, description, file picker
   - Document detail/preview page
   - Search bar
   - SEO meta tags (title, description, Open Graph)
4. Public access - koi login required nahi viewing ke liye
