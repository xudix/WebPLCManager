import { TestBed } from '@angular/core/testing';

import { SymbolListService } from './symbol-list.service';

describe('SymbolListService', () => {
  let service: SymbolListService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SymbolListService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
