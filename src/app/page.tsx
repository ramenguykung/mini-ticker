import CheckInForm from '@/components/CheckInForm'; 
import Link from 'next/link';

export default function Home() {
	return (
	<main className="min-h-screen bg-gradient-to-br from-teal-50 to-indigo-200 py-12 px-4">
			<div className="max-w-6xl mx-auto">
				<div className="text-center mb-12">
					<h1 className="text-4xl font-bold text-gray-900 mb-4">
						Mini Ticker: Anonymous Check-In System
					</h1>
					<p className="text-lg text-gray-600">
						Simple, secure, and anonymous check-in tracking
					</p>
				</div>

				<div className="grid md:grid-cols-2 gap-8 items-start">
					<CheckInForm />

					<div className="bg-white p-6 rounded-lg shadow-xl">
						<h2 className="text-2xl font-bold mb-4 text-gray-800">How It Works</h2>
						<div className="space-y-4">
							<div className="flex items-start gap-3">
								<div className="shrink-0 w-8 h-8 bg-teal-600 text-white rounded-full flex items-center justify-center font-bold">
									1
								</div>
								<div>
									<h3 className="font-semibold text-gray-900">Anonymous Identity</h3>
									<p className="text-sm text-gray-600">
										Generate a unique ID or let the system create one for you. No personal info required.
									</p>
								</div>
							</div>

							<div className="flex items-start gap-3">
								<div className="shrink-0 w-8 h-8 bg-teal-600 text-white rounded-full flex items-center justify-center font-bold">
									2
								</div>
								<div>
									<h3 className="font-semibold text-gray-900">Check In</h3>
									<p className="text-sm text-gray-600">
										Click the Check In button. Your full ID will be stored locally on your device.
									</p>
								</div>
							</div>

							<div className="flex items-start gap-3">
								<div className="shrink-0 w-8 h-8 bg-teal-600 text-white rounded-full flex items-center justify-center font-bold">
									3
								</div>
								<div>
									<h3 className="font-semibold text-gray-900">Check Out</h3>
									<p className="text-sm text-gray-600">
										When you&apos;re done, click Check Out to update your status.
									</p>
								</div>
							</div>
						</div>

						<div className="mt-6 pt-6 border-t border-gray-200">
							<Link
								href="/dashboard"
								className="block text-center bg-gray-800 text-white py-2 px-4 rounded-md hover:bg-gray-900 transition-colors font-medium"
							>
								View Dashboard
							</Link>
						</div>
					</div>
				</div>
			</div>
		</main>
	);
}