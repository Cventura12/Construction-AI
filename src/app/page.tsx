import Recorder from "@/components/Recorder";

const HomePage = () => {
  return (
    <main className="min-h-screen bg-zinc-200 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-6 rounded-2xl border-2 border-black bg-white p-4 shadow-[0_8px_0_#000]">
          <h1 className="text-3xl font-black uppercase tracking-tight text-zinc-900">
            HammerVoice
          </h1>
          <p className="mt-2 text-sm font-semibold text-zinc-700">
            Record your field update, then generate a structured daily report.
          </p>
        </header>
        <Recorder />
      </div>
    </main>
  );
};

export default HomePage;

