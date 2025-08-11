import { useLogin, useSession } from "@/lib/auth-client";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import Loader from "./loader";
import { Button } from "./ui/button";

export default function SignUpForm({
	onSwitchToSignIn,
}: {
	onSwitchToSignIn: () => void;
}) {
	const navigate = useNavigate({
		from: "/",
	});
	const { isLoading } = useSession();
	const { login, isPending } = useLogin();

	if (isLoading) {
		return <Loader />;
	}

	return (
		<div className="mx-auto w-full mt-10 max-w-md p-6">
			<h1 className="mb-6 text-center text-3xl font-bold">Create Account</h1>
			<p className="text-center text-gray-600 mb-6">
				Sign up with your Google account to get started
			</p>

			<Button
				onClick={() => login()}
				className="w-full"
				disabled={isPending}
			>
				{isPending ? "Redirecting..." : "Sign up with Google"}
			</Button>

			<div className="mt-4 text-center">
				<Button
					variant="link"
					onClick={onSwitchToSignIn}
					className="text-indigo-600 hover:text-indigo-800"
				>
					Already have an account? Sign In
				</Button>
			</div>
		</div>
	);
}
