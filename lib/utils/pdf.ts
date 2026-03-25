"use client";

/**
 * PDF generation utilities for member lists and event attendee lists.
 *
 * Uses jsPDF + jspdf-autotable for table rendering.
 *
 * Korean font support:
 *   jsPDF's built-in fonts (Helvetica, etc.) do not support Korean characters.
 *   To display Korean text correctly, place a NanumGothic.ttf file at:
 *     /public/fonts/NanumGothic.ttf
 *   This file is fetched at runtime and registered with jsPDF.
 *   If the font file is missing, PDF generation continues with the default font
 *   (Korean characters will render as boxes/question marks).
 *
 * Download NanumGothic from Google Fonts or Naver:
 *   https://fonts.google.com/specimen/Nanum+Gothic
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Profile } from "@/lib/types/profile";
import type { AttendeeRow } from "@/components/manage-event-client";

// ─── Role label mapping (English for PDF export) ──────────────────────────────

/** Maps Korean-style role values to readable English labels for the PDF. */
function formatRole(role: string): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "member":
      return "Member";
    case "pending":
      return "Pending";
    default:
      return role;
  }
}

// ─── Payment status label + color mapping ─────────────────────────────────────

/** Returns an RGB color tuple for a given payment status, used in PDF cell styling. */
function paymentStatusColor(
  status: string | undefined,
): [number, number, number] {
  switch (status) {
    case "confirmed":
      return [22, 163, 74]; // Tailwind green-600
    case "pending":
      return [202, 138, 4]; // Tailwind yellow-600
    default:
      // 'rejected', undefined (no payment) = unpaid
      return [220, 38, 38]; // Tailwind red-600
  }
}

/** Returns a readable label for a payment status shown in the PDF. */
function formatPaymentStatus(status: string | undefined): string {
  switch (status) {
    case "confirmed":
      return "Paid";
    case "pending":
      return "Pending";
    case "rejected":
      return "Rejected";
    default:
      return "Unpaid";
  }
}

// ─── Korean font loader ───────────────────────────────────────────────────────

/**
 * Attempts to load and register the NanumGothic Korean font with the jsPDF instance.
 * Fetches the TTF file from /public/fonts/NanumGothic.ttf, converts it to a
 * Base64 string, and registers it using jsPDF's addFileToVFS / addFont APIs.
 *
 * If the font file is not found (404) or any error occurs, the function returns
 * false and PDF generation continues with the default Latin font.
 *
 * @param doc - The jsPDF instance to register the font with
 * @returns true if the font was loaded successfully, false otherwise
 */
async function loadKoreanFont(doc: jsPDF): Promise<boolean> {
  try {
    // Fetch the TTF font file from the public directory
    const response = await fetch("/fonts/NanumGothic.ttf");
    if (!response.ok) return false;

    // Convert the font binary to a Base64 string for jsPDF's VFS
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    // Register the font file in jsPDF's virtual file system
    doc.addFileToVFS("NanumGothic.ttf", base64);
    // Register the font family so it can be selected with setFont()
    doc.addFont("NanumGothic.ttf", "NanumGothic", "normal");
    // Set as the active font for all subsequent text operations
    doc.setFont("NanumGothic");
    return true;
  } catch {
    // Font loading is non-critical — continue with default font
    return false;
  }
}

// ─── Date helpers ──────────────────────────────────────────────────────────────

/** Returns today's date as a YYYY-MM-DD string for use in file names and titles. */
function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

/** Builds a concise KAIST education summary string (e.g. "BS 2010 · MS 2012"). */
function buildKaistSummary(profile: Profile): string {
  const parts: string[] = [];
  if (profile.kaist_bs_year) parts.push(`BS ${profile.kaist_bs_year}`);
  // Skip MS when the member was in the integrated MS/PhD program
  if (!profile.is_integrated_ms_phd && profile.kaist_ms_year)
    parts.push(`MS ${profile.kaist_ms_year}`);
  if (profile.kaist_phd_year) parts.push(`PhD ${profile.kaist_phd_year}`);
  return parts.join(" · ");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates and downloads a PDF listing all members.
 *
 * Columns: Name | Role | Phone | KAIST | Joined
 * File name: members-YYYY-MM-DD.pdf
 *
 * @param profiles - Array of Profile objects to include in the list
 */
export async function generateMemberListPdf(
  profiles: Profile[],
): Promise<void> {
  // Use landscape orientation to accommodate the additional Company and Job Title columns
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Attempt to load Korean font; capture the font name to pass into autoTable.
  // autoTable manages its own font stack independently from doc.setFont(),
  // so we must explicitly set styles.font — otherwise it reverts to Helvetica
  // and Korean characters render as garbled Latin-1 bytes.
  const koreanFont = await loadKoreanFont(doc);
  const fontName = koreanFont ? "NanumGothic" : "helvetica";

  const today = todayString();

  // ── Title ──
  doc.setFontSize(16);
  doc.text(`Member List - ${today}`, 14, 20);

  // ── Table ──
  autoTable(doc, {
    startY: 28,
    head: [
      ["Name", "Role", "Phone", "KAIST", "Company", "Job Title", "Joined"],
    ],
    body: profiles.map((p) => [
      p.display_name || p.full_name,
      formatRole(p.role),
      p.phone || "-",
      buildKaistSummary(p) || "-",
      p.company || "-",
      p.job_title || "-",
      new Date(p.created_at).toLocaleDateString("en-US"),
    ]),
    headStyles: {
      // Dark header row with white text
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      // Subtle alternating row background for readability
      fillColor: [248, 250, 252],
    },
    styles: {
      // Must explicitly set font here — autoTable does not inherit doc.setFont()
      font: fontName,
      fontSize: 10,
      cellPadding: 3,
    },
  });

  // ── Download ──
  doc.save(`members-${today}.pdf`);
}

/**
 * Generates and downloads a PDF listing all attendees for an event.
 *
 * Columns: Name | Adults | Children | Fee | Payment Status
 * Payment Status cells are color-coded:
 *   - Paid (confirmed)  → green
 *   - Pending           → yellow/amber
 *   - Unpaid / Rejected → red
 *
 * File name: attendees-{eventTitle}-YYYY-MM-DD.pdf
 *
 * @param attendees  - Array of AttendeeRow objects (profile + rsvp + payment)
 * @param eventTitle - The title of the event, used in the PDF heading and file name
 */
export async function generateAttendeeListPdf(
  attendees: AttendeeRow[],
  eventTitle: string,
): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Same font-propagation fix as generateMemberListPdf:
  // autoTable requires styles.font to be set explicitly.
  const koreanFont = await loadKoreanFont(doc);
  const fontName = koreanFont ? "NanumGothic" : "helvetica";

  const today = todayString();

  // ── Title ──
  doc.setFontSize(16);
  doc.text(`${eventTitle} - Attendees`, 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${today}`, 14, 27);
  doc.setTextColor(0);

  // Pre-compute the payment status for each row so didParseCell can access it
  const paymentStatuses = attendees.map((a) => a.payment?.status);

  // ── Table ──
  autoTable(doc, {
    startY: 33,
    head: [["Name", "Adults", "Children", "Fee ($)", "Payment Status"]],
    body: attendees.map((a) => [
      a.profile.display_name,
      String(a.rsvp.adult_guests),
      String(a.rsvp.child_guests),
      String(a.totalFee),
      formatPaymentStatus(a.payment?.status),
    ]),
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    styles: {
      // Must explicitly set font here — autoTable does not inherit doc.setFont()
      font: fontName,
      fontSize: 10,
      cellPadding: 3,
    },
    // Color the "Payment Status" column (index 4) based on payment state
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 4) {
        const status = paymentStatuses[data.row.index];
        const [r, g, b] = paymentStatusColor(status);
        // Apply color to the text in the Payment Status cell
        data.cell.styles.textColor = [r, g, b];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  // ── Summary footer ──
  const confirmedCount = attendees.filter(
    (a) => a.payment?.status === "confirmed",
  ).length;
  const totalFee = attendees.reduce((sum, a) => sum + a.totalFee, 0);

  // Position the footer below the table
  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } })
    .lastAutoTable.finalY;
  doc.setFontSize(10);
  doc.text(
    `Total: ${attendees.length} attendees · ${confirmedCount} paid · $${totalFee} expected`,
    14,
    finalY + 8,
  );

  // ── Download ──
  // Replace spaces/special chars in event title with hyphens for a safe file name
  const safeTitle = eventTitle.replace(/[^a-zA-Z0-9가-힣]/g, "-").slice(0, 30);
  doc.save(`attendees-${safeTitle}-${today}.pdf`);
}
