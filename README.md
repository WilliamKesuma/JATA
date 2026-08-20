# JATA — Job Application Tailoring Assistant

<div align="center">
  <h3>⚡ AI-Powered CV Parsing, Experience Bank Extraction & Real-Time Job Application Tailoring</h3>
  <p>Transform your comprehensive CV into targeted job summaries, matching qualification highlights, and tailored cover emails in seconds.</p>

  <p>
    <img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js" alt="Next.js 16" />
    <img src="https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react" alt="React 19" />
    <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Google_Gemini-3.5_%2F_3.7-8E75B2?style=for-the-badge&logo=google" alt="Gemini" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css" alt="Tailwind CSS v4" />
    <img src="https://img.shields.io/badge/Vercel-Deployed-000000?style=for-the-badge&logo=vercel" alt="Vercel" />
  </p>
</div>

---

## 🌟 Overview

**JATA (Job Application Tailoring Assistant)** is a modern, full-stack AI application designed to streamline the job hunt. Instead of manually editing your resume for every single job posting, JATA:

1. **Ingests your CV** across multiple formats (PDF with native multimodal OCR, DOCX, or TXT).
2. **Builds an Experience Bank** of structured, quantified achievement bullets across cloud engineering, software, analytics, product, leadership, and public speaking.
3. **Analyzes target job requirements** in real-time.
4. **Synthesizes tailored application materials**:
   - 🎯 **Executive CV Profile Summary** (3–4 sentence hook aligned to the role).
   - ✉️ **High-Impact Cover Email** (<150 words, concise, ready to send).
   - 🔍 **Prioritized Experience Bullets** (ranked match highlights from your CV bank).

---

## ✨ Key Features

- **⚡ Native Multimodal PDF Parsing**: Powered directly by Gemini's multimodal vision engine to handle multi-column layouts, tables, and scanned text with zero native C++/canvas dependencies.
- **📂 Universal Format Support**: Supports PDF, DOCX (via pure JavaScript XML extraction), and plain text exports up to 5 MB.
- **🗂️ Interactive Experience Bank**:
  - Live keyword search across roles, technologies, and achievements.
  - Category filter pills (`cloud-infrastructure`, `software-mobile`, `data-analytics`, `product-operations`, `leadership-management`, `speaking-achievements`).
  - Metric extraction badges (e.g. `86 Lambdas`, `4.8/5 rating`, `41% escalation drop`).
  - Strength classification (`high`, `medium`, `low`) for impact prioritization.
- **🎨 Modern 2-Column AI Studio UI**: Sleek dark-mode glassmorphism interface with instant sample job insertion, progress spinners, tabbed output previews, and 1-click clipboard copying.
- **🛡️ Built-in Rate Limiting & Cost Protection**:
  - Per-IP rate limiting (10 generations/hour per visitor).
  - Cooldown anti-spam throttling (10-second interval).
  - Daily global budget cap to keep Gemini API usage bounded.
  - Upstash Redis support with graceful in-memory fallback on Vercel.
  - 
---

## 🚀 Tech Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **UI & Components**: [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/)
- **AI Engine**: [Google GenAI SDK (`@google/genai`)](https://www.npmjs.com/package/@google/genai)
- **Document Extractors**: Native Gemini Multimodal Vision (PDF), [Mammoth](https://www.npmjs.com/package/mammoth) (DOCX)
- **Rate Limiting**: [Upstash Redis](https://upstash.com/) REST API / In-memory fallback
- **Deployment**: [Vercel](https://vercel.com/)

---

## 👤 Author

**William Sanjaya Kesuma**
- LinkedIn: [William Sanjaya Kesuma](https://www.linkedin.com/in/williamskesuma/)
- GitHub: [@WilliamKesuma](https://github.com/WilliamKesuma)
