import { ReactNode } from 'react';

// Meeting pages don't use the shared StreamVideoProvider
// They have their own provider that supports guest mode
const MeetingLayout = ({ children }: Readonly<{ children: ReactNode }>) => {
    return <main>{children}</main>;
};

export default MeetingLayout;
