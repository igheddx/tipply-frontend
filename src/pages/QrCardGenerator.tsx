import React, { useMemo, useState } from 'react'

const CARD_WIDTH_IN = 4
const CARD_HEIGHT_IN = 6

export default function QrCardGenerator() {
  const [performerName, setPerformerName] = useState('Your Performer Name')
  const [qrUrl, setQrUrl] = useState('')
  const [artistUrl, setArtistUrl] = useState('')
  const [cta, setCta] = useState('Scan to tip instantly')
  const [message, setMessage] = useState('Support the music you love')

  const printableStyle = useMemo(() => ({
    width: `${CARD_WIDTH_IN}in`,
    height: `${CARD_HEIGHT_IN}in`,
  }), [])

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[360px,1fr] gap-6">
        <div className="bg-white shadow-sm rounded-xl border border-gray-200 p-4 space-y-4">
          <h1 className="text-xl font-semibold text-gray-900">Tipwave QR Card Generator</h1>
          <p className="text-sm text-gray-600">Enter details and print a 4x6 portrait card.</p>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Performer name</label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={performerName}
              onChange={(e) => setPerformerName(e.target.value)}
              placeholder="Performer name"
            />
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">QR code image URL</label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={qrUrl}
              onChange={(e) => setQrUrl(e.target.value)}
              placeholder="Paste QR code image URL (e.g., /api/devices/{id}/qr)"
            />
            <p className="text-xs text-gray-500">Use the existing device QR endpoint or any hosted QR PNG.</p>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Optional artist URL</label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={artistUrl}
              onChange={(e) => setArtistUrl(e.target.value)}
              placeholder="https://linktr.ee/artist"
            />
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Headline message</label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Call to action</label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={cta}
              onChange={(e) => setCta(e.target.value)}
            />
          </div>

          <button
            onClick={() => window.print()}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Print 4x6 Card
          </button>

          <p className="text-xs text-gray-500">
            Drop the Tipwave logo file at /public/images/logo/tipwave-logo.png (transparent) for the header. The QR code renders from the URL you provide.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Live preview (4x6 in, portrait)</h2>
          <div className="flex justify-center">
            <div
              className="bg-white border border-gray-300 shadow relative overflow-hidden"
              style={printableStyle}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-white" />
              <div className="relative h-full flex flex-col items-center px-6 py-6 space-y-4">
                {/* Logo */}
                <img
                  src="/images/logo/tipwave-logo.png"
                  alt="Tipwave logo"
                  className="h-16 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />

                {/* Message */}
                <div className="text-center space-y-1">
                  <p className="text-base font-semibold text-gray-900">{message}</p>
                  <p className="text-sm text-gray-600">{cta}</p>
                </div>

                {/* QR */}
                <div className="flex-1 flex items-center justify-center w-full">
                  {qrUrl ? (
                    <img
                      src={qrUrl}
                      alt="Performer QR"
                      className="w-52 h-52 object-contain border border-gray-200 p-2 bg-white"
                    />
                  ) : (
                    <div className="w-52 h-52 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-xs text-gray-400 text-center p-3">
                      Paste a QR code URL to preview
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="w-full text-center space-y-1 pb-2">
                  <p className="text-lg font-bold text-gray-900">{performerName}</p>
                  {artistUrl && (
                    <p className="text-xs text-blue-600 truncate max-w-full">{artistUrl}</p>
                  )}
                  <p className="text-xs text-gray-500">Printed 4x6" QR card · Tipwave</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body { margin: 0; }
          /* Print only the card */
          .print-hide { display: none !important; }
          .print-only-card {
            width: ${CARD_WIDTH_IN}in;
            height: ${CARD_HEIGHT_IN}in;
          }
        }
      `}</style>
    </div>
  )
}
