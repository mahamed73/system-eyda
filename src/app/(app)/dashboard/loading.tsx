/** Skeleton loading للداشبورد — كروت رمادية بتنبض لحد ما البيانات توصل */
export default function DashboardLoading() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="h-6 w-48 bg-slate-200 rounded-lg animate-pulse mb-2" />
      <div className="h-4 w-32 bg-slate-100 rounded-lg animate-pulse mb-6" />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
              <div className="w-9 h-9 rounded-full bg-slate-100 animate-pulse" />
            </div>
            <div className="h-7 w-16 bg-slate-200 rounded animate-pulse" />
            <div className="h-3 w-28 bg-slate-100 rounded animate-pulse mt-2" />
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6">
          <div className="h-5 w-40 bg-slate-200 rounded animate-pulse mb-4" />
          <div className="h-40 bg-slate-100 rounded-lg animate-pulse" />
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <div className="h-5 w-32 bg-slate-200 rounded animate-pulse mb-4" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse mb-3" />
          ))}
        </div>
      </div>
    </div>
  );
}
