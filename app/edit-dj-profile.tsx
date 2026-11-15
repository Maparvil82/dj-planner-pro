import ProfileScreen from './profile';
import { CommunityTermsProvider } from '../src/components/community/CommunityTerms';

// Consent stays in this native sheet, above the editor. A root-level native
// Modal cannot reliably present over an existing native-stack modal on iOS.
export default function EditDJProfileScreen() {
    return (
        <CommunityTermsProvider presentation="inline">
            <ProfileScreen editorOnly />
        </CommunityTermsProvider>
    );
}
