import { TestBed } from "@angular/core/testing";

import { WatchPageService } from "./watch-page.service";

describe("WatchPageService", () => {
  let service: WatchPageService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WatchPageService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });
});
