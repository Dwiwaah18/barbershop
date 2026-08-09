import { Calendar, Clock, Scissors, PlusCircle } from 'lucide-react';

export default function BookingPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
      <h1 className="text-4xl font-bold mb-2">Book Appointment</h1>
      <p className="text-gray-400 mb-8">Senopati Branch &bull; Walk-ins and Reservations</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          {/* Main Services */}
          <div className="glass-panel p-6 rounded-2xl">
            <h2 className="text-2xl font-semibold mb-4">Select Service</h2>
            <div className="space-y-4">
              {['Classic Haircut', 'Premium Fade', 'Kids Haircut'].map((service, idx) => (
                <label key={idx} className="flex items-center justify-between p-4 rounded-xl border border-[var(--border)] bg-white/5 cursor-pointer hover:border-primary transition-colors">
                  <div className="flex items-center gap-4">
                    <input type="radio" name="main_service" className="w-5 h-5 accent-primary" />
                    <div>
                      <h4 className="font-medium text-lg">{service}</h4>
                      <p className="text-sm text-gray-400">45 mins</p>
                    </div>
                  </div>
                  <span className="font-bold">Rp {idx === 2 ? '50.000' : '75.000'}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Smart Add-ons */}
          <div className="glass-panel p-6 rounded-2xl">
            <div className="flex items-center gap-2 mb-4">
              <PlusCircle className="h-5 w-5 text-primary" />
              <h2 className="text-2xl font-semibold">Recommended Add-ons</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {['Hair Wash & Tonic', 'Beard Trim', 'Black Mask'].map((addon, idx) => (
                <label key={idx} className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-white/5 cursor-pointer hover:border-primary transition-colors">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" className="w-4 h-4 rounded text-primary accent-primary" />
                    <span className="font-medium text-sm">{addon}</span>
                  </div>
                  <span className="text-sm text-primary">+Rp 25k</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar / Live Barber Status */}
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Clock className="h-5 w-5" /> Live Barber Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span>Dwi Wahyudi</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500"></span> Free</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>Alex</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"></span> Busy</span>
              </div>
            </div>
          </div>
          
          <div className="glass-panel p-6 rounded-2xl">
            <h3 className="font-bold text-lg mb-4">Order Summary</h3>
            <div className="flex justify-between mb-2 text-sm text-gray-400"><span>Service</span><span>Rp 75.000</span></div>
            <div className="flex justify-between mb-4 text-sm text-gray-400"><span>Add-ons</span><span>Rp 0</span></div>
            <div className="border-t border-[var(--border)] pt-4 flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-primary">Rp 75.000</span>
            </div>
            <button className="w-full mt-6 bg-primary hover:bg-amber-700 text-white font-bold py-3 rounded-xl transition-transform active:scale-95">
              Confirm Booking
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
