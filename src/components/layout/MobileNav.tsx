'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { SignOutButton } from './SignOutButton';

export default function MobileNav({ isSignedIn }: { isSignedIn: boolean }) {
    const [open, setOpen] = useState(false);
    const pathname = usePathname();

    // Tutup menu otomatis kalau pindah halaman.
    useEffect(() => {
        setOpen(false);
    }, [pathname]);

    return (
        <div className="md:hidden">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-label={open ? 'Tutup menu' : 'Buka menu'}
                className="p-2 -mr-2 text-gray-300 hover:text-white transition-colors"
            >
                {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>

            {open && (
                <div className="absolute top-full left-0 w-full glass border-b border-[var(--border)] shadow-xl">
                    <div className="px-4 py-3 space-y-1">
                        <Link
                            href="/"
                            className="block px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-white/5 hover:text-primary transition-colors"
                        >
                            Home
                        </Link>
                        <Link
                            href="/booking"
                            className="block px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-white/5 hover:text-primary transition-colors"
                        >
                            Booking
                        </Link>
                        <Link
                            href="/branches"
                            className="block px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-white/5 hover:text-primary transition-colors"
                        >
                            Branches
                        </Link>

                        {isSignedIn ? (
                            <>
                                <Link
                                    href="/my-bookings"
                                    className="block px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-white/5 hover:text-primary transition-colors"
                                >
                                    My Bookings
                                </Link>
                                <Link
                                    href="/profile"
                                    className="block px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-white/5 hover:text-primary transition-colors"
                                >
                                    Profile
                                </Link>
                                <div className="px-3 pt-2">
                                    <SignOutButton />
                                </div>
                            </>
                        ) : (
                            <Link
                                href="/auth"
                                className="block text-center bg-primary hover:bg-amber-700 text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium transition-colors mt-2"
                            >
                                Sign In
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}