import { SkeletonLoader } from "./components/SkeletonLoader";

export default function App() {
  return (
    <div className="size-full flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md h-full bg-white shadow-xl overflow-auto">
        <SkeletonLoader />
      </div>
    </div>
  );
}