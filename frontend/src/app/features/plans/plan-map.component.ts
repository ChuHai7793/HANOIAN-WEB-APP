import { afterNextRender, Component, DOCUMENT, effect, ElementRef, inject, input, OnDestroy, viewChild } from '@angular/core';
import type { LayerGroup, Map as LeafletMap } from 'leaflet';
import { PlanStop } from '../../core/models/plan.model';

/** CSS của Leaflet được copy sang dist (angular.json → assets); chỉ nạp khi trang có bản đồ */
const LEAFLET_CSS = 'vendor/leaflet/leaflet.css';

function ensureLeafletCss(doc: Document): Promise<void> {
  const existing = doc.head.querySelector<HTMLLinkElement>(`link[href="${LEAFLET_CSS}"]`);
  if (existing) return existing.sheet ? Promise.resolve() : new Promise((resolve) => existing.addEventListener('load', () => resolve(), { once: true }));
  return new Promise((resolve) => {
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = LEAFLET_CSS;
    link.onload = () => resolve();
    link.onerror = () => resolve();
    doc.head.appendChild(link);
  });
}

/**
 * Bản đồ các điểm của plan (Leaflet + bản đồ OpenStreetMap): marker đánh số theo thứ tự, nối bằng đường thẳng.
 * Leaflet (JS lẫn CSS) chỉ được tải khi trang có bản đồ. Điểm thiếu toạ độ không hiện trên bản đồ.
 */
@Component({
  selector: 'app-plan-map',
  template: `<div #host class="h-72 w-full overflow-hidden rounded-2xl border border-brand-100 bg-brand-50"></div>`,
})
export class PlanMapComponent implements OnDestroy {
  readonly stops = input.required<PlanStop[]>();

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private readonly doc = inject(DOCUMENT);
  private map: LeafletMap | null = null;
  private layer: LayerGroup | null = null;
  private leaflet: typeof import('leaflet') | null = null;

  constructor() {
    afterNextRender(async () => {
      const [L] = await Promise.all([import('leaflet'), ensureLeafletCss(this.doc)]);
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
