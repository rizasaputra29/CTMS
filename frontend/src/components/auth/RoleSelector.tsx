'use client';

import { useAuth } from '@/context/AuthContext';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import { UserCog, GraduationCap, BookOpen } from 'lucide-react';

const roleConfig: Record<string, { label: string; description: string; icon: React.ReactNode }> = {
    admin: {
        label: 'Administrator',
        description: 'Manage system settings and users',
        icon: <UserCog className="h-8 w-8" />,
    },
    dosen: {
        label: 'Dosen',
        description: 'Manage courses and grades',
        icon: <BookOpen className="h-8 w-8" />,
    },
    mahasiswa: {
        label: 'Mahasiswa',
        description: 'View courses and grades',
        icon: <GraduationCap className="h-8 w-8" />,
    },
};

interface RoleSelectorProps {
    open: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function RoleSelector({ open, onOpenChange }: RoleSelectorProps) {
    const { user, switchRole } = useAuth();

    if (!user || !user.roles || user.roles.length <= 1) {
        return null;
    }

    const handleRoleSelect = (role: string) => {
        switchRole(role);
        onOpenChange?.(false);
    };

    return (
        <Dialog open={open} {...(onOpenChange ? { onOpenChange } : {})}>
            <DialogContent className="sm:max-w-[480px]" showCloseButton={false}>
                <DialogHeader>
                    <DialogTitle>Select Your Role</DialogTitle>
                    <DialogDescription>
                        You have access to multiple roles. Please select one to continue.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {user.roles.map((role) => {
                        const config = roleConfig[role] || {
                            label: role.charAt(0).toUpperCase() + role.slice(1),
                            description: `Access ${role} dashboard`,
                            icon: <UserCog className="h-8 w-8" />,
                        };
                        return (
                            <Card
                                key={role}
                                className="cursor-pointer hover:border-primary hover:bg-accent/50 transition-colors"
                                onClick={() => handleRoleSelect(role)}
                            >
                                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                        {config.icon}
                                    </div>
                                    <div>
                                        <CardTitle>{config.label}</CardTitle>
                                        <CardDescription>{config.description}</CardDescription>
                                    </div>
                                </CardHeader>
                            </Card>
                        );
                    })}
                </div>
            </DialogContent>
        </Dialog>
    );
}
