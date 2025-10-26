import CheckInList from "@/components/CheckInList";
import Link from "next/link";

export default function Dashboard() {
    return (
        <main className="min-h-screen bg-linear-to-br from-gray-50 to-gray-100 py-12 px-4">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            Dashboard
                        </h1>
                        <p className="text-gray-600 mt-1">
                            Monitor all active check-ins
                        </p>
                    </div>
                    <Link
                        href="/"
                        className="bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700 transition-colors font-medium">
                        Back to Home
                    </Link>
                </div>

                <CheckInList />
            </div>
        </main>
    );
}
