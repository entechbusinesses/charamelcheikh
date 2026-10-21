import { useEffect, useRef, useState } from "react";

export default function AnimatedLogo({ className }: { className?: string }) {
  const path1Ref = useRef<SVGPathElement>(null);
  const path2Ref = useRef<SVGPathElement>(null);
  const path3Ref = useRef<SVGPathElement>(null);
  const path4Ref = useRef<SVGPathElement>(null);
  const [pathLengths, setPathLengths] = useState<number[]>([0, 0, 0, 0]);
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    const paths = [
      path1Ref.current,
      path2Ref.current,
      path3Ref.current,
      path4Ref.current,
    ];
    const lengths = paths.map((path) => (path ? path.getTotalLength() : 0));
    setPathLengths(lengths);

    setIsAnimating(false);
    setTimeout(() => setIsAnimating(true), 50);
  }, []);

  return (
    <div>
      <svg
        viewBox="0 0 291 395"
        fill="none"
        className={className}
        style={{ maxWidth: "300px" }}
      >
        {isAnimating && (
          <>
            {/* Drawing paths */}
            <path
              ref={path1Ref}
              d="M182.52 135.247C182.52 157.757 178.48 177.227 170.4 193.647C162.32 210.067 151.99 223.647 139.41 234.377C123.08 248.307 107.73 254.737 98.88 258.207C58.83 273.937 20.47 269.937 0.0100098 266.147C4.50001 265.517 57.41 257.697 88.74 235.367C100.25 227.157 109.86 217.327 109.86 217.327C117.26 209.747 123.86 201.387 129.66 192.257C140.52 175.157 145.96 156.167 145.96 135.237C144.9 101.597 131.52 72.3271 105.82 47.4271C103.17 44.8571 95.08 37.2871 83.06 29.6571C53.37 10.8171 21.7 5.67712 0 4.50712C16.32 0.787117 57.43 -6.30289 99.26 12.0471C119.07 20.7371 132.85 32.5171 136.42 35.4871C149.13 46.0871 159.99 59.6571 169 76.2171C178.01 92.7971 182.52 112.467 182.52 135.247Z"
              stroke="currentColor"
              strokeWidth="2"
              fill="transparent"
              style={{
                strokeDasharray: pathLengths[0],
                strokeDashoffset: pathLengths[0],
                animation: `drawPath ${2}s ease-in-out forwards`,
              }}
            />
            <path
              ref={path2Ref}
              d="M104.03 117.127C82.45 112.167 64.98 104.607 52.15 97.8371V217.047C53.75 208.997 66.75 147.687 116.68 128.237C124.11 125.337 134 122.717 146.31 122.477C134.42 122.167 120.02 120.807 104.03 117.127Z"
              stroke="currentColor"
              strokeWidth="2"
              fill="transparent"
              style={{
                strokeDasharray: pathLengths[1],
                strokeDashoffset: pathLengths[1],
                animation: `drawPath ${1.5}s ease-in-out ${0.5}s forwards`,
              }}
            />
            <path
              ref={path3Ref}
              d="M276.97 116.607L277.04 116.497H235.71C235.7 116.507 235.69 116.527 235.68 116.537L209.36 116.497C212.1 118.677 214.26 120.307 215.76 121.427C216.55 122.017 217.25 122.507 218.04 123.387C220.42 126.037 221.62 129.077 221.62 132.527C221.62 134.907 220.96 137.297 219.63 139.677L127.97 282.977C108.26 313.437 88.54 343.907 68.83 374.367C63.7 382.297 55.79 386.667 55.79 386.667C51.02 390.227 46.62 392.657 43.4 394.237L56.8 394.257L56.73 394.367H98.06C98.07 394.357 98.08 394.337 98.09 394.327L124.41 394.367C121.67 392.187 119.51 390.557 118.01 389.437C117.22 388.847 116.52 388.357 115.73 387.477C113.35 384.827 112.15 381.787 112.15 378.337C112.15 375.957 112.81 373.567 114.14 371.187L205.8 227.887C225.51 197.427 245.23 166.957 264.94 136.497C270.07 128.567 277.98 124.197 277.98 124.197C282.75 120.637 287.15 118.207 290.37 116.627L276.97 116.607Z"
              stroke="currentColor"
              strokeWidth="2"
              fill="transparent"
              style={{
                strokeDasharray: pathLengths[2],
                strokeDashoffset: pathLengths[2],
                animation: `drawPath ${2.5}s ease-in-out ${1}s forwards`,
              }}
            />
            <path
              ref={path4Ref}
              d="M232.56 375.777C210.78 390.867 188.64 393.797 177.59 394.457L278.63 394.627V297.277C277.67 304.927 271.44 348.827 232.56 375.777Z"
              stroke="currentColor"
              strokeWidth="2"
              fill="transparent"
              style={{
                strokeDasharray: pathLengths[3],
                strokeDashoffset: pathLengths[3],
                animation: `drawPath ${1.5}s ease-in-out ${2}s forwards`,
              }}
            />

            {/* Fill overlays */}
            <path
              d="M182.52 135.247C182.52 157.757 178.48 177.227 170.4 193.647C162.32 210.067 151.99 223.647 139.41 234.377C123.08 248.307 107.73 254.737 98.88 258.207C58.83 273.937 20.47 269.937 0.0100098 266.147C4.50001 265.517 57.41 257.697 88.74 235.367C100.25 227.157 109.86 217.327 109.86 217.327C117.26 209.747 123.86 201.387 129.66 192.257C140.52 175.157 145.96 156.167 145.96 135.237C144.9 101.597 131.52 72.3271 105.82 47.4271C103.17 44.8571 95.08 37.2871 83.06 29.6571C53.37 10.8171 21.7 5.67712 0 4.50712C16.32 0.787117 57.43 -6.30289 99.26 12.0471C119.07 20.7371 132.85 32.5171 136.42 35.4871C149.13 46.0871 159.99 59.6571 169 76.2171C178.01 92.7971 182.52 112.467 182.52 135.247Z"
              fill="currentColor"
              style={{
                fillOpacity: 0,
                animation: `fillPath 1s ease-in-out ${2.5}s forwards`,
              }}
            />
            <path
              d="M104.03 117.127C82.45 112.167 64.98 104.607 52.15 97.8371V217.047C53.75 208.997 66.75 147.687 116.68 128.237C124.11 125.337 134 122.717 146.31 122.477C134.42 122.167 120.02 120.807 104.03 117.127Z"
              fill="currentColor"
              style={{
                fillOpacity: 0,
                animation: `fillPath 1s ease-in-out ${2.7}s forwards`,
              }}
            />
            <path
              d="M276.97 116.607L277.04 116.497H235.71C235.7 116.507 235.69 116.527 235.68 116.537L209.36 116.497C212.1 118.677 214.26 120.307 215.76 121.427C216.55 122.017 217.25 122.507 218.04 123.387C220.42 126.037 221.62 129.077 221.62 132.527C221.62 134.907 220.96 137.297 219.63 139.677L127.97 282.977C108.26 313.437 88.54 343.907 68.83 374.367C63.7 382.297 55.79 386.667 55.79 386.667C51.02 390.227 46.62 392.657 43.4 394.237L56.8 394.257L56.73 394.367H98.06C98.07 394.357 98.08 394.337 98.09 394.327L124.41 394.367C121.67 392.187 119.51 390.557 118.01 389.437C117.22 388.847 116.52 388.357 115.73 387.477C113.35 384.827 112.15 381.787 112.15 378.337C112.15 375.957 112.81 373.567 114.14 371.187L205.8 227.887C225.51 197.427 245.23 166.957 264.94 136.497C270.07 128.567 277.98 124.197 277.98 124.197C282.75 120.637 287.15 118.207 290.37 116.627L276.97 116.607Z"
              fill="currentColor"
              style={{
                fillOpacity: 0,
                animation: `fillPath 1s ease-in-out ${3}s forwards`,
              }}
            />
            <path
              d="M232.56 375.777C210.78 390.867 188.64 393.797 177.59 394.457L278.63 394.627V297.277C277.67 304.927 271.44 348.827 232.56 375.777Z"
              fill="currentColor"
              style={{
                fillOpacity: 0,
                animation: `fillPath 1s ease-in-out ${3.2}s forwards`,
              }}
            />
          </>
        )}
      </svg>

      <style>{`
        @keyframes drawPath {
          to {
            stroke-dashoffset: 0;
          }
        }
        @keyframes fillPath {
          to {
            fill-opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
