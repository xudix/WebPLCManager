import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SymbolSelectorComponent } from './symbol-selector.component';

describe('SymbolSelectorComponent', () => {
  let component: SymbolSelectorComponent;
  let fixture: ComponentFixture<SymbolSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SymbolSelectorComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SymbolSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
