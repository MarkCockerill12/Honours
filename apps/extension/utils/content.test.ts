import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { blurContent, clearBlurContent } from "./content";
import { SmartFilter } from "@privacy-shield/core";

describe("Content Filter (blurContent)", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    container.innerHTML = `
      <p id="p1">This is a safe sentence.</p>
      <p id="p2">This contains a badword here.</p>
      <div id="d1">Another badword is mentioned in this div.</div>
    `;
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    clearBlurContent();
  });

  it('filters specific words with "word" scope', () => {
    const filters: SmartFilter[] = [
      {
        id: "1",
        blockTerm: "badword",
        enabled: true,
        blockScope: "word",
        exceptWhen: "",
      },
    ];

    const count = blurContent(container, filters, "blur");
    expect(count).toBe(2);

    const filteredSpans = container.querySelectorAll(
      '[data-content-filtered="true"]',
    );
    expect(filteredSpans.length).toBe(2);
    expect(filteredSpans[0].textContent).toBe("badword");
    expect((filteredSpans[0] as HTMLElement).style.filter).toBe("blur(6px)");
  });

  it('filters entire paragraphs with "paragraph" scope', () => {
    const filters: SmartFilter[] = [
      {
        id: "1",
        blockTerm: "badword",
        enabled: true,
        blockScope: "paragraph",
        exceptWhen: "",
      },
    ];

    const count = blurContent(container, filters, "blackbar");
    expect(count).toBe(2);

    const filteredElements = container.querySelectorAll(
      '[data-content-filtered="true"]',
    );
    // It should flag the p and the div
    expect(filteredElements.length).toBe(2);
    expect(filteredElements[0].tagName).toBe("P");
    expect((filteredElements[0] as HTMLElement).style.backgroundColor).toBe(
      "rgb(0, 0, 0)",
    );
  });

  it('respects "exceptWhen" exclusion rules', () => {
    container.innerHTML = `<p>This has badword but also has permission.</p>`;
    const filters: SmartFilter[] = [
      {
        id: "1",
        blockTerm: "badword",
        enabled: true,
        blockScope: "word",
        exceptWhen: "permission",
      },
    ];

    const count = blurContent(container, filters, "blur");
    expect(count).toBe(0);
    expect(
      container.querySelectorAll('[data-content-filtered="true"]').length,
    ).toBe(0);
  });

  it("clears filters correctly", () => {
    const filters: SmartFilter[] = [
      {
        id: "1",
        blockTerm: "badword",
        enabled: true,
        blockScope: "word",
        exceptWhen: "",
      },
    ];

    blurContent(container, filters, "blur");
    expect(
      container.querySelectorAll('[data-content-filtered="true"]').length,
    ).toBe(2);

    clearBlurContent();
    expect(
      container.querySelectorAll('[data-content-filtered="true"]').length,
    ).toBe(0);
    expect(container.textContent).toContain("badword");
  });
});
