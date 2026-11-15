import { type ComponentProps } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { PageHeaderBody } from './PageHeaderBody';
import { ScrollPageHeader } from './ScrollPageHeader';

type Props = ComponentProps<typeof PageHeaderBody> & { progress?: SharedValue<number> };
export function PageHeader({ progress, ...props }: Props) {
    return progress ? <ScrollPageHeader {...props} progress={progress} variant="hide" /> : <PageHeaderBody {...props} />;
}
