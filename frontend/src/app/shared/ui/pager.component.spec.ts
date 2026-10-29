import { pageNumbers } from './pager.component';

describe('pageNumbers (thanh phân trang)', () => {
  it('ít trang thì hiện hết', () => {
    expect(pageNumbers(1, 1)).toEqual([1]);
    expect(pageNumbers(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('nhiều trang: đầu, cuối, trang hiện tại ±1, khoảng trống thành "…"', () => {
    expect(pageNumbers(1, 12)).toEqual([1, 2, null, 12]);
    expect(pageNumbers(6, 12)).toEqual([1, null, 5, 6, 7, null, 12]);
    expect(pageNumbers(12, 12)).toEqual([1, null, 11, 12]);
  });

  it('cách đúng một số thì hiện số đó thay vì "…"', () => {
    expect(pageNumbers(4, 12)).toEqual([1, 2, 3, 4, 5, null, 12]);
    expect(pageNumbers(9, 12)).toEqual([1, null, 8, 9, 10, 11, 12]);
  });
});
