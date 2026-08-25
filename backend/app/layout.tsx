import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MOOX Commerce",
  description: "Commerce backend & storefront MOOX smart glasses",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
