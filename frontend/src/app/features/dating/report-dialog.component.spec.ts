import { TestBed } from '@angular/core/testing';
import { ReportDialogComponent, ReportInput } from './report-dialog.component';

describe('ReportDialogComponent', () => {
  it('gửi lý do đã chọn, ghi chú (bỏ khoảng trắng) và có chặn hay không', () => {
    const fixture = TestBed.createComponent(ReportDialogComponent);
    fixture.componentRef.setInput('name', 'Lan');
    fixture.detectChanges();
    const sent: ReportInput[] = [];
    fixture.componentInstance.send.subscribe((v) => sent.push(v));
    const el = fixture.nativeElement as HTMLElement;

    const select = el.querySelector('select')!;
    select.value = 'harassment';
    select.dispatchEvent(new Event('change'));
    const note = el.querySelector('textarea')!;
    note.value = '  nhắn tin khiếm nhã  ';
    note.dispatchEvent(new Event('input'));
    const block = el.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    block.checked = false;
    block.dispatchEvent(new Event('change'));

    const buttons = el.querySelectorAll('button');
    (buttons[buttons.length - 1] as HTMLButtonElement).click();

    expect(sent).toEqual([{ reason: 'harassment', note: 'nhắn tin khiếm nhã', block: false }]);
  });
});
