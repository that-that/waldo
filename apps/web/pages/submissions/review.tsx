import {
  Box,
  Center,
  Text,
  Flex,
  Button,
  Image,
  chakra,
} from '@chakra-ui/react';
import { Session } from 'next-auth';
import { getSession } from 'next-auth/react';
import { useState, useEffect, ReactElement, useCallback } from 'react';
import { useRouter } from 'next/router';
import Loading from '@components/Loading';
import Layout from '@components/Layout';
import { trpc } from '@utils/trpc';
import Head from 'next/head';

interface ReviewItem {
  user?:
    | {
        name?: string | null;
      }
    | undefined;
  upVotes?: number | undefined;
  downVotes?: number | undefined;
  id: string;
  userId: string;
  youtubeUrl: string;
  footageType: string;
  isAnalyzed: boolean;
}
export default function Review() {
  const utils = trpc.useContext();
  const {
    isLoading: reviewItemLoading,
    data: reviewItemData,
    refetch,
  } = trpc.gameplay.getReviewItems.useQuery();

  const reviewGameplay = trpc.gameplay.reviewGameplay.useMutation({
    async onSuccess() {
      await utils.gameplay.invalidate();
    },
  });

  const [userSession, setUserSession] = useState<Session | undefined>();
  const [reviewItem, setReviewItem] = useState<ReviewItem | undefined>(
    reviewItemData,
  );
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();
  const videoIdFromUrlRegex =
    // eslint-disable-next-line no-useless-escape
    /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  // format http://img.youtube.com/vi/[video-id]/[thumbnail-number].jpg
  const getYtEmbedLink = (url: string) => {
    const result = url.match(videoIdFromUrlRegex);
    if (result == null) {
      return;
    }
    return `https://youtube.com/embed/${result[2]}`;
  };

  const doClickLogic = async (action: 'yes' | 'no') => {
    setLoading(true);
    const review = action === 'yes';
    await reviewGameplay.mutateAsync({
      gameplayId: reviewItem.id,
      actualGame: reviewItem.footageType,
      isGame: review,
    });
    await refetch();
    setReviewItem(reviewItemData);
    setLoading(false);
  };

  const handleYesClick = () => {
    doClickLogic('yes');
  };

  const handleNoClick = () => {
    doClickLogic('no');
  };

  useEffect(() => {
    const getNecessaryData = async () => {
      await refetch();
      setReviewItem(reviewItemData);
      setLoading(false);
    };
    const getCurrentSession = async () => {
      const session = await getSession();
      // if blacklisted just keep loading, don't load page
      if (session?.user?.blacklisted) {
        setLoading(true);
        return;
      }
      if (session === null) {
        router.push('/auth/login');
      } else {
        setUserSession(session);
      }
    };
    getCurrentSession();
    getNecessaryData();
  }, [reviewItemLoading]);
  return (
    <>
      <Head>
        <title>Submissions | Review</title>
        <meta
          name="description"
          content="Waldo is an Open-source visual cheat detection, powered by A.I"
        />
      </Head>
      <div>
        <Center h={'100vh'}>
          {loading || reviewItemLoading ? (
            <Loading color={'default'} />
          ) : (
            <>
              <Box bgColor={'white'} p={6} borderRadius={12}>
                <Flex direction={'row'}>
                  {/* User Icon */}
                  <Box>
                    <Image
                      src={userSession?.user?.image as string}
                      alt={'User Icon'}
                      w={54}
                      h={54}
                      borderRadius={28}
                    />
                  </Box>
                  {/* Top titles */}
                  {reviewItem && (
                    <Flex
                      direction={'column'}
                      justifyContent={'center'}
                      fontSize={18}
                      ml={2}
                    >
                      <Text>
                        Submitted by&nbsp;
                        <chakra.span fontWeight={'bold'}>
                          {reviewItem?.user?.name}
                        </chakra.span>
                      </Text>

                      <Text fontWeight={'bold'}>
                        Does this clip match gameplay from{' '}
                        <chakra.span fontWeight={'normal'}>
                          {reviewItem?.footageType}
                        </chakra.span>
                      </Text>
                    </Flex>
                  )}
                </Flex>
                {/* Iframe */}
                <Box mt={6}>
                  {/* we might want to find a alternative to iframe as it doesn't inherit styles from parent w chakra -ceri */}
                  {reviewItem && (
                    <iframe
                      src={getYtEmbedLink(reviewItem.youtubeUrl)}
                      style={{
                        borderRadius: 12,
                        width: '100%',
                        height: '42vh',
                      }}
                    />
                  )}
                </Box>
                {/* Footer */}
                <Flex mt={4} alignItems={'center'}>
                  <Text>
                    By answering you accept the{' '}
                    <chakra.span
                      fontWeight={'semibold'}
                      textDecoration={'underline'}
                    >
                      Terms of Service
                    </chakra.span>
                  </Text>
                  {/* Button */}
                  <Box ml={'auto'} right={0}>
                    <Button
                      color={'white'}
                      bgColor={'#373737'}
                      px={4}
                      _hover={{ bgColor: '#474747' }}
                      mr={3}
                      ml={3}
                      onClick={() => handleYesClick()}
                    >
                      Yes
                    </Button>
                    <Button
                      variant="outline"
                      color={'#373737'}
                      borderColor={'#373737'}
                      px={4}
                      _hover={{ bgColor: 'gray.300' }}
                      onClick={() => handleNoClick()}
                    >
                      No
                    </Button>
                  </Box>
                </Flex>
              </Box>
            </>
          )}
        </Center>
      </div>
    </>
  );
}

Review.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>;
};
