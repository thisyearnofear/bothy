"use client";

export default function PrintButton() {
  return <button className="btn no-print" onClick={() => window.print()}>Print or save the case file</button>;
}
