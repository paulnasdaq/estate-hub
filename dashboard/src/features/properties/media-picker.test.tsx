import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, test } from "vitest";

import { render, screen } from "@/test/test-utils";
import { MediaPicker } from "./components/media-picker";

// A tiny controlled wrapper so the picker's onChange actually updates the
// rendered file list, the way the real form does.
function Harness() {
  const [files, setFiles] = useState<File[]>([]);
  return <MediaPicker files={files} onChange={setFiles} />;
}

describe("MediaPicker", () => {
  test("adds picked files to the list and removes them", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const input = screen.getByLabelText("Add media files");
    const file = new File(["hello"], "lease.pdf", { type: "application/pdf" });
    await user.upload(input, file);

    expect(screen.getByText("lease.pdf")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove lease.pdf" }));
    expect(screen.queryByText("lease.pdf")).not.toBeInTheDocument();
  });

  test("de-dupes the same file picked twice", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const input = screen.getByLabelText("Add media files");
    const makeFile = () =>
      new File(["x"], "kitchen.jpg", {
        type: "image/jpeg",
        lastModified: 1,
      });

    await user.upload(input, makeFile());
    await user.upload(input, makeFile());

    expect(screen.getAllByText("kitchen.jpg")).toHaveLength(1);
  });
});
