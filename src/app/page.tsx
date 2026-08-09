import Link from 'next/link';
import { ArrowRight, Scissors, CalendarCheck, ShieldCheck } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <div className="text-center max-w-4xl mx-auto mb-16">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
          The Ultimate <span className="text-primary">Enterprise</span> Barbershop
        </h1>
        <p className="text-xl md:text-2xl text-gray-400 mb-10">
          Secure, transparent, and seamless operations for multi-branch barbershops. Book your appointment now.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/booking" className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold rounded-full text-primary-foreground bg-primary hover:bg-amber-700 transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(217,119,6,0.4)]">
            Book Appointment <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
          <Link href="/dashboard" className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold rounded-full text-white bg-white/10 hover:bg-white/20 backdrop-blur-md transition-all border border-white/10">
            Owner Dashboard
          </Link>
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto w-full mt-12">
        <div className="glass-panel p-8 rounded-2xl flex flex-col items-center text-center group hover:border-primary/50 transition-colors duration-300">
          <div className="bg-primary/20 p-4 rounded-full mb-6 group-hover:scale-110 transition-transform">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-bold mb-3">Secure & Reliable</h3>
          <p className="text-gray-400">Google Sign-in and enterprise-grade security for your data and deposit balances.</p>
        </div>
        
        <div className="glass-panel p-8 rounded-2xl flex flex-col items-center text-center group hover:border-primary/50 transition-colors duration-300">
          <div className="bg-primary/20 p-4 rounded-full mb-6 group-hover:scale-110 transition-transform">
            <CalendarCheck className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-bold mb-3">Smart Booking</h3>
          <p className="text-gray-400">Real-time queue tracking, live barber status, and smart upselling recommendations.</p>
        </div>

        <div className="glass-panel p-8 rounded-2xl flex flex-col items-center text-center group hover:border-primary/50 transition-colors duration-300">
          <div className="bg-primary/20 p-4 rounded-full mb-6 group-hover:scale-110 transition-transform">
            <Scissors className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-bold mb-3">Multi-Branch POS</h3>
          <p className="text-gray-400">Seamless integration between online bookings and walk-ins across all your outlets.</p>
        </div>
      </div>
    </div>
  );
}
