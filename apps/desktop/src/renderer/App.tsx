export function App() {
  // Empty page on the canvas. The top strip is the drag area of the hidden title bar.
  return (
    <main className="h-screen bg-canvas text-foreground">
      <div className="h-10 [-webkit-app-region:drag]" />
    </main>
  );
}
