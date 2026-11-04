export default function AppLogo() {
    return (
        <>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0A2647]">
                <img src="/logo.svg" alt="" className="h-6 w-6 object-contain" />
            </div>
            <span className="ml-1 truncate text-left text-sm font-semibold text-[#0A2647]">Lockr</span>
        </>
    );
}
