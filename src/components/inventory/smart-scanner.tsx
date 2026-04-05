'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import { Camera, X, RefreshCw, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

interface SmartScannerProps {
    onScan: (barcode: string) => void;
    onClose: () => void;
    isOpen: boolean;
}

export function SmartScanner({ onScan, onClose, isOpen }: SmartScannerProps) {
    const [cameraReady, setCameraReady] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const divId = "qr-reader";

    useEffect(() => {
        if (isOpen && !scannerRef.current) {
            const scanner = new Html5Qrcode(divId);
            scannerRef.current = scanner;

            const config = {
                fps: 10,
                qrbox: { width: 250, height: 180 },
                aspectRatio: 1.0
            };

            scanner.start(
                { facingMode: "environment" },
                config,
                (decodedText) => {
                    onScan(decodedText);
                    stopScanner();
                },
                (errorMessage) => {
                    // SILENT logs for mobile noise
                }
            ).then(() => {
                setCameraReady(true);
                setIsScanning(true);
            }).catch(err => {
                console.error("Scanner failed:", err);
            });
        }

        return () => {
            if (scannerRef.current && isScanning) {
                stopScanner();
            }
        };
    }, [isOpen]);

    const stopScanner = async () => {
        if (scannerRef.current) {
            try {
                await scannerRef.current.stop();
                scannerRef.current = null;
                setIsScanning(false);
                onClose();
            } catch (e) {
                console.error(e);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[1001] bg-black flex flex-col items-center justify-center pt-20 pb-40 px-6 backdrop-blur-3xl"
            >
                <div className="absolute top-6 left-6 right-6 flex justify-between items-center z-50">
                    <div className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-indigo-500 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Rapid Camera Engine</span>
                    </div>
                    <Button
                        variant="ghost"
                        onClick={stopScanner}
                        className="rounded-2xl h-12 w-12 bg-white/10 hover:bg-white/20 text-white border-white/10"
                    >
                        <X className="h-6 w-6" />
                    </Button>
                </div>

                <div className="relative w-full max-w-sm aspect-square rounded-[3rem] overflow-hidden border-4 border-indigo-600/50 shadow-[0_0_80px_rgba(79,70,229,0.3)]">
                    <div id={divId} className="w-full h-full object-cover scale-150" />

                    {/* Scanner Overlay UI */}
                    <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-indigo-500 shadow-[0_0_15px_rgba(79,70,229,1)] animate-scan-line"></div>
                    <div className="absolute inset-0 border-[3rem] border-black/40 pointer-events-none"></div>
                </div>

                <div className="mt-12 text-center space-y-2">
                    <p className="text-white font-black text-xs uppercase tracking-widest italic opacity-80 underline underline-offset-4 decoration-indigo-500 decoration-2">Align Barcode within Frame</p>
                    <p className="text-white/30 text-[10px] font-bold uppercase tracking-tighter">Instant Product Identification v3.0</p>
                </div>

                {!cameraReady && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black gap-4 text-white">
                        <RefreshCw className="h-10 w-10 animate-spin text-indigo-600" />
                        <p className="text-xs font-black uppercase tracking-widest opacity-40">Waking Up Optics Node...</p>
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    );
}

