import { afterNextRender, Component, effect, ElementRef, input, OnDestroy, viewChild } from '@angular/core';
import type { LayerGroup, Map as LeafletMap } from 'leaflet';
import { PlanStop } from '../../core/models/plan.model';

/**
 * Bản đồ các điểm của plan (Leaflet + bản đồ OpenStreetMap): marker đánh số theo thứ tự, nối bằng đường thẳng.
 * Leaflet chỉ được tải khi trang có bản đồ. Điểm thiếu toạ độ không hiện trên bản đồ.
 */
@Component({
  selector: 'app-plan-map',
  template: `<div #host class="h-72 w-full overflow-hidden rounded-2xl border border-brand-100 bg-brand-50"></div>`,
})
export class PlanMapComponent implements OnDestroy {
  readonly stops = input.required<PlanStop[]>();

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private map: LeafletMap | null = null;
  private layer: LayerGroup | null = null;
  private leaflet: typeof import('leaflet') | null = null;

  constructor() {
    afterNextRender(async () => {
      const L = await import('leaflet');
      this.leaflet = L;
      this.map = L.map(this.host().nativeElement, { scrollWheelZoom: false }).setView([21.0285, 105.8542], 13);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(this.map);
      this.layer = L.layerGroup().addTo(this.map);
      this.draw(this.stops());
    });
    effect(() => {
      const stops = this.stops();
      if (this.map) this.draw(stops);
    });
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private draw(stops: PlanStop[]): void {
    const L = this.leaflet;
    if (!L || !this.map || !this.layer) return;
    this.layer.clearLayers();
    const points: [number, number][] = [];
    stops.forEach((s, i) => {
      if (s.lat === null || s.lng === null) return;
      points.push([s.lat, s.lng]);
      const icon = L.divIcon({
        className: '',
        html: `<span class="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-brand-600 text-xs font-bold text-white shadow">${i + 1}</span>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      L.marker([s.lat, s.lng], { icon, title: s.name }).bindTooltip(`${i + 1}. ${escapeHtml(s.name)}`).addTo(this.layer!);
    });
    if (points.length >= 2) {
      L.polyline(points, { color: '#6D4FD6', weight: 3, opacity: 0.7, dashArray: '6 6' }).addTo(this.layer);
    }
    if (points.length === 1) this.map.setView(points[0], 15);
    else if (points.length > 1) this.map.fitBounds(L.latLngBounds(points), { padding: [30, 30] });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
