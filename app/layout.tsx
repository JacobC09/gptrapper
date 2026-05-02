import type { Metadata } from "next";
import { Manrope, Space_Grotesk, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

const geist = Geist({subsets:["latin"],variable:"--font-sans"});

const manrope = Manrope({
    subsets: ["latin"],
    variable: "--font-manrope",
});

const spaceGrotesk = Space_Grotesk({
    subsets: ["latin"],
    variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
    title: "GPT wRAPPER",
    description: "Precision Audio Capture",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="en"
            className={cn("dark", manrope.variable, spaceGrotesk.variable, "font-sans", geist.variable)}
        >
            <body className="bg-background text-on-background min-h-screen flex flex-col font-body-md overflow-y-auto antialiased relative">
                <link
                    rel="stylesheet"
                    href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
                    precedence="default"
                />
                <Toaster />
                {children}
            </body>
        </html>
    );
}
