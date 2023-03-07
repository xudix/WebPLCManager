import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PersistentPageComponent } from './persistent-page.component';

describe('PersistentPageComponent', () => {
  let component: PersistentPageComponent;
  let fixture: ComponentFixture<PersistentPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PersistentPageComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PersistentPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
