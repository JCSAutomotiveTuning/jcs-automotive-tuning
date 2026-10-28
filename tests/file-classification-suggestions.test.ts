import {describe,expect,it} from "vitest";
import {suggestFileIdentifiers} from "../lib/file-identifier-suggestions";
describe("file sorting suggestions",()=>{
  it("suggests both labelled HW/SW without saving",()=>{
    const x=suggestFileIdentifiers("HW_03L906022DH-SW_9978.bin");
    expect(x.hwId).toBe("03L906022DH");
    expect(x.swId).toBe("9978");
    expect(x.needsReview).toBe(true);
  });
  it("keeps ambiguous originals undefined",()=>{
    const x=suggestFileIdentifiers("03L906022DH_9978.bin");
    expect(x.source).toBe("none");
    expect(x.hwId).toBeNull();
    expect(x.swId).toBeNull();
  });
  it("does not classify partially labelled files",()=>{
    const x=suggestFileIdentifiers("HW_03L906022DH.ori");
    expect(x.swId).toBeNull();
    expect(x.needsReview).toBe(true);
  });
});