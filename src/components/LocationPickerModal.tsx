import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import { X, LocateFixed } from 'lucide-react';
import L from 'leaflet';

const pinkElleIcon = L.divIcon({
  html: `<div class="flex flex-col items-center drop-shadow-xl">
           <div class="w-12 h-12 bg-gradient-to-br from-pink-500 to-pink-600 rounded-full border-[3px] border-white flex items-center justify-center shadow-inner relative z-10 overflow-hidden">
               <span class="text-white font-extrabold text-sm italic font-serif">Pink<br/>Elle</span>
           </div>
           <div class="w-3 h-3 bg-pink-600 rotate-45 -mt-1.5 z-0"></div>
         </div>`,
  className: 'bg-transparent border-none',
  iconSize: [48, 54],
  iconAnchor: [24, 54],
  popupAnchor: [0, -50],
});

function MapController() {
  const map = useMap();

  const goToCurrentLocation = () => {
      if ('geolocation' in navigator) {
         navigator.geolocation.getCurrentPosition((pos) => {
             map.flyTo([pos.coords.latitude, pos.coords.longitude], 15);
         });
      }
  };

  return (
    <div className="leaflet-top leaflet-right" style={{ pointerEvents: 'auto', marginTop: '10px', marginRight: '10px' }}>
       <button 
         onClick={(e) => {
             e.preventDefault();
             e.stopPropagation();
             goToCurrentLocation();
         }}
         className="bg-white p-2 rounded-xl border border-slate-200 shadow-md hover:bg-slate-50 text-slate-700 transition"
         title="GPS Current Location"
       >
          <LocateFixed size={24} className="text-pink-600" />
       </button>
    </div>
  );
}

function LocationMarker({ position, setPosition }: { position: L.LatLng | null, setPosition: (pos: L.LatLng) => void }) {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  return position === null ? null : (
    <Marker position={position} icon={pinkElleIcon}></Marker>
  );
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
}

export default function LocationPickerModal({ isOpen, onClose, onSelectLocation, initialLat = 36.1901, initialLng = 44.0094 }: Props) {
  const [position, setPosition] = useState<L.LatLng | null>(
    initialLat && initialLng && initialLat !== 36.1901 ? new L.LatLng(initialLat, initialLng) : null
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
       <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <div>
               <h2 className="text-lg font-extrabold text-slate-800">دیاریکردنی شوێن لەسەر نەخشە</h2>
               <p className="text-xs font-medium text-slate-500 mt-1">کرتە لەسەر نەخشە بکە بۆ دانانی نیشانەکە</p>
            </div>
            <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors">
               <X size={18} />
            </button>
          </div>
          <div className="w-full h-[400px] relative z-0">
             <MapContainer 
                center={[initialLat, initialLng]} 
                zoom={13} 
                style={{ height: '100%', width: '100%', zIndex: 0 }}
             >
                <MapController />
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <LocationMarker position={position} setPosition={setPosition} />
             </MapContainer>
          </div>
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
             <div className="text-xs font-mono text-slate-500 flex items-center gap-2" dir="ltr">
                 {position ? `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}` : 'هیچ شوێنێک دیارینەکراوە'}
             </div>
             <div className="flex gap-3">
                 <button type="button" onClick={onClose} className="px-5 py-2 text-slate-600 hover:bg-slate-200 rounded-xl text-sm font-bold transition-colors">
                   پاشگەزبوونەوە
                 </button>
                 <button 
                  type="button"
                  onClick={() => {
                      if (position) {
                          onSelectLocation(position.lat, position.lng);
                          onClose();
                      }
                  }}
                  disabled={!position}
                  className="px-6 py-2 bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-50 disabled:hover:bg-pink-600 rounded-xl text-sm font-bold shadow-sm transition-colors">
                   هەڵبژاردنی ئەم شوێنە
                 </button>
             </div>
          </div>
       </div>
    </div>
  );
}
