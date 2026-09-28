import { isShortMapsLink, parseGmapUrl } from './gmap-url';

describe('parseGmapUrl', () => {
  it.each([
    ['21.0285, 105.8542', 21.0285, 105.8542],
    ['https://www.google.com/maps/@21.0285,105.8542,17z', 21.0285, 105.8542],
    ['https://maps.google.com/?q=21.0285,105.8542', 21.0285, 105.8542],
    ['https://www.google.com/maps/search/21.0285,+105.8542?entry=tts', 21.0285, 105.8542],
    ['https://www.google.com/maps/search/?api=1&query=21.0285%2C105.8542', 21.0285, 105.8542],
  ])('đọc được %s', (input, lat, lng) => {
    expect(parseGmapUrl(input)).toEqual({ lat, lng });
  });

  it('ưu tiên vị trí ghim !3d!4d hơn tâm bản đồ @', () => {
    const url = 'https://www.google.com/maps/place/X/@10.0,100.0,15z/data=!3d21.5!4d105.5';
    expect(parseGmapUrl(url)).toEqual({ lat: 21.5, lng: 105.5 });
  });

  it.each(['', 'https://maps.app.goo.gl/AbC123', '91, 200', 'abc%zz'])(
    'không có toạ độ: %s',
    (input) => {
      expect(parseGmapUrl(input)).toEqual({ lat: null, lng: null });
    },
  );
});

describe('isShortMapsLink', () => {
  it('nhận link rút gọn của Google Maps', () => {
    expect(isShortMapsLink('https://maps.app.goo.gl/AbC123')).toBe(true);
    expect(isShortMapsLink(' https://goo.gl/maps/xyz ')).toBe(true);
  });

  it('không nhận link khác', () => {
    expect(isShortMapsLink('https://www.google.com/maps/@21,105,17z')).toBe(false);
    expect(isShortMapsLink('http://maps.app.goo.gl/AbC123')).toBe(false);
    expect(isShortMapsLink('https://goo.gl/other')).toBe(false);
  });
});
