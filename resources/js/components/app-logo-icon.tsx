import { SVGAttributes } from 'react';

export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    return (
        <svg {...props} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="10" width="16" height="11" rx="2" fill="currentColor" />
            <path d="M8 10V7a4 4 0 1 1 8 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="15" r="1.25" fill="white" />
            <path d="M12 16.25V18" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}
