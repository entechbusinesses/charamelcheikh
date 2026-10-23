import { useEffect } from "react";

/*
 * On phones, tables with the "mobile-cards" class are shown as cards (see
 * index.css). This copies each column header onto its cells as data-label so
 * the card can show "Total : 120 DH". Watches the DOM, so tables that render
 * later (lists, modals) are labelled too.
 */
const label = () => {
  document.querySelectorAll("table.mobile-cards").forEach((table) => {
    const headers = Array.from(
      table.querySelectorAll(":scope > thead > tr:last-child > th")
    ).map((th) => th.textContent?.replace(/[↑↓]/g, "").trim() ?? "");
    table.querySelectorAll(":scope > tbody > tr").forEach((row) => {
      Array.from(row.children).forEach((cell, i) => {
        const text = headers[i] ?? "";
        if (cell.getAttribute("data-label") !== text) {
          cell.setAttribute("data-label", text);
        }
      });
    });
  });
};

export default function TableCardLabels() {
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(label);
    };
    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
