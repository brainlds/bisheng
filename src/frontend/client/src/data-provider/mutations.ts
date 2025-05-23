import type { InfiniteData, UseMutationResult } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type * as t from '~/data-provider/data-provider/src';
import {
  Constants,
  ConversationListResponse,
  MutationKeys, QueryKeys,
  dataService,
  defaultAssistantsVersion,
  defaultOrderQuery,
} from '~/data-provider/data-provider/src';
import useUpdateTagsInConvo from '~/hooks/Conversations/useUpdateTagsInConvo';
import {
  /* Conversations */
  addConversation,
  deleteConversation,
  logger,
  updateConversation,
  updateConvoFields,
} from '~/utils';
import { normalizeData } from '~/utils/collection';
import { updateConversationTag } from '~/utils/conversationTags';
import { useConversationTagsQuery, useConversationsInfiniteQuery } from './queries';

export type TGenTitleMutation = UseMutationResult<
  t.TGenTitleResponse,
  unknown,
  t.TGenTitleRequest,
  unknown
>;

/** Conversations */
export const useGenTitleMutation = (): TGenTitleMutation => {
  const queryClient = useQueryClient();
  return useMutation((payload: t.TGenTitleRequest) => dataService.genTitle(payload), {
    onSuccess: (response, vars) => {
      queryClient.setQueryData(
        [QueryKeys.conversation, vars.conversationId],
        (convo: t.TConversation | undefined) => {
          if (!convo) {
            return convo;
          }
          return { ...convo, title: response.title };
        },
      );
      queryClient.setQueryData<t.ConversationData>([QueryKeys.allConversations], (convoData) => {
        if (!convoData) {
          return convoData;
        }
        return updateConvoFields(convoData, {
          conversationId: vars.conversationId,
          title: response.title,
        } as t.TConversation);
      });
      // document.title = response.title;
    },
  });
};

export const useUpdateConversationMutation = (
  id: string,
): UseMutationResult<
  t.TUpdateConversationResponse,
  unknown,
  t.TUpdateConversationRequest,
  unknown
> => {
  const queryClient = useQueryClient();
  return useMutation(
    (payload: t.TUpdateConversationRequest) => dataService.updateConversation(payload),
    {
      onSuccess: (updatedConvo, payload) => {
        const convo = {
          ...payload,
          "_id": "67f7b0911047906c64090ac9",
          "user": "",
          "__v": 0,
          "createdAt": "2025-04-10T11:50:41.882Z",
          "endpoint": "Deepseek",
          "endpointType": "custom",
          "expiredAt": null,
          "files": [],
          "isArchived": false,
          "messages": [
            "67f7b0911047906c64090ac8",
            "67f7b0951047906c64090aca",
            "67f7cf011047906c64090ad3",
            "67f7cf091047906c64090ad4",
            "67f7cf0e1047906c64090ad5",
            "67f7cfea1047906c64090ad8",
            "67f7cff01047906c64090ad9"
          ],
          "model": "deepseek-chat",
          "resendFiles": true,
          "tags": [],
          "updatedAt": "2025-04-11T06:15:00.445Z"
        }
        queryClient.setQueryData([QueryKeys.conversation, id], convo);
        queryClient.setQueryData<t.ConversationData>([QueryKeys.allConversations], (convoData) => {
          if (!convoData) {
            return convoData;
          }
          return updateConversation(convoData, convo);
        });
      },
    },
  );
};

/**
 * Add or remove tags for a conversation
 */
export const useTagConversationMutation = (
  conversationId: string,
  options?: t.updateTagsInConvoOptions,
): UseMutationResult<t.TTagConversationResponse, unknown, t.TTagConversationRequest, unknown> => {
  const query = useConversationTagsQuery();
  const { updateTagsInConversation } = useUpdateTagsInConvo();
  return useMutation(
    (payload: t.TTagConversationRequest) =>
      dataService.addTagToConversation(conversationId, payload),
    {
      onSuccess: (updatedTags, ...rest) => {
        // Because the logic for calculating the bookmark count is complex,
        // the client does not perform the calculation,
        // but instead refetch the data from the API.
        query.refetch();
        updateTagsInConversation(conversationId, updatedTags);

        options?.onSuccess?.(updatedTags, ...rest);
      },
      onError: options?.onError,
      onMutate: options?.onMutate,
    },
  );
};

export const useArchiveConversationMutation = (
  id: string,
): UseMutationResult<
  t.TArchiveConversationResponse,
  unknown,
  t.TArchiveConversationRequest,
  unknown
> => {
  const queryClient = useQueryClient();
  const { refetch } = useConversationsInfiniteQuery();
  const { refetch: archiveRefetch } = useConversationsInfiniteQuery({
    pageNumber: '1', // dummy value not used to refetch
    isArchived: true,
  });
  return useMutation(
    (payload: t.TArchiveConversationRequest) => dataService.archiveConversation(payload),
    {
      onSuccess: (_data, vars) => {
        const isArchived = vars.isArchived === true;
        if (isArchived) {
          queryClient.setQueryData([QueryKeys.conversation, id], null);
        } else {
          queryClient.setQueryData([QueryKeys.conversation, id], _data);
        }

        queryClient.setQueryData<t.ConversationData>([QueryKeys.allConversations], (convoData) => {
          if (!convoData) {
            return convoData;
          }
          const pageSize = convoData.pages[0].pageSize as number;

          return normalizeData(
            isArchived ? deleteConversation(convoData, id) : addConversation(convoData, _data),
            'conversations',
            pageSize,
          );
        });

        if (isArchived) {
          const current = queryClient.getQueryData<t.ConversationData>([
            QueryKeys.allConversations,
          ]);
          refetch({ refetchPage: (page, index) => index === (current?.pages.length ?? 1) - 1 });
        }

        queryClient.setQueryData<t.ConversationData>(
          [QueryKeys.archivedConversations],
          (convoData) => {
            if (!convoData) {
              return convoData;
            }
            const pageSize = convoData.pages[0].pageSize as number;
            return normalizeData(
              isArchived ? addConversation(convoData, _data) : deleteConversation(convoData, id),
              'conversations',
              pageSize,
            );
          },
        );

        if (!isArchived) {
          const currentArchive = queryClient.getQueryData<t.ConversationData>([
            QueryKeys.archivedConversations,
          ]);
          archiveRefetch({
            refetchPage: (page, index) => index === (currentArchive?.pages.length ?? 1) - 1,
          });
        }
      },
    },
  );
};

export const useArchiveConvoMutation = (options?: t.ArchiveConvoOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess, ..._options } = options ?? {};

  return useMutation<t.TArchiveConversationResponse, unknown, t.TArchiveConversationRequest>(
    (payload: t.TArchiveConversationRequest) => dataService.archiveConversation(payload),
    {
      onSuccess: (_data, vars) => {
        const { conversationId } = vars;
        const isArchived = vars.isArchived === true;
        if (isArchived) {
          queryClient.setQueryData([QueryKeys.conversation, conversationId], null);
        } else {
          queryClient.setQueryData([QueryKeys.conversation, conversationId], _data);
        }

        queryClient.setQueryData<t.ConversationData>([QueryKeys.allConversations], (convoData) => {
          if (!convoData) {
            return convoData;
          }
          const pageSize = convoData.pages[0].pageSize as number;
          return normalizeData(
            isArchived
              ? deleteConversation(convoData, conversationId)
              : addConversation(convoData, _data),
            'conversations',
            pageSize,
          );
        });

        queryClient.setQueryData<t.ConversationData>(
          [QueryKeys.archivedConversations],
          (convoData) => {
            if (!convoData) {
              return convoData;
            }
            const pageSize = convoData.pages[0].pageSize as number;
            return normalizeData(
              isArchived
                ? addConversation(convoData, _data)
                : deleteConversation(convoData, conversationId),
              'conversations',
              pageSize,
            );
          },
        );

        onSuccess?.(_data, vars);
      },
      ..._options,
    },
  );
};

export const useCreateSharedLinkMutation = (
  options?: t.MutationOptions<t.TCreateShareLinkRequest, { conversationId: string }>,
): UseMutationResult<t.TSharedLinkResponse, unknown, { conversationId: string }, unknown> => {
  const queryClient = useQueryClient();

  const { onSuccess, ..._options } = options || {};
  return useMutation(
    ({ conversationId }: { conversationId: string }) => {
      if (!conversationId) {
        throw new Error('Conversation ID is required');
      }

      return dataService.createSharedLink(conversationId);
    },
    {
      onSuccess: (_data: t.TSharedLinkResponse, vars, context) => {
        queryClient.setQueryData([QueryKeys.sharedLinks, _data.conversationId], _data);

        onSuccess?.(_data, vars, context);
      },
      ..._options,
    },
  );
};

export const useUpdateSharedLinkMutation = (
  options?: t.MutationOptions<t.TUpdateShareLinkRequest, { shareId: string }>,
): UseMutationResult<t.TSharedLinkResponse, unknown, { shareId: string }, unknown> => {
  const queryClient = useQueryClient();

  const { onSuccess, ..._options } = options || {};
  return useMutation(
    ({ shareId }) => {
      if (!shareId) {
        throw new Error('Share ID is required');
      }
      return dataService.updateSharedLink(shareId);
    },
    {
      onSuccess: (_data: t.TSharedLinkResponse, vars, context) => {
        queryClient.setQueryData([QueryKeys.sharedLinks, _data.conversationId], _data);

        onSuccess?.(_data, vars, context);
      },
      ..._options,
    },
  );
};

export const useDeleteSharedLinkMutation = (
  options?: t.DeleteSharedLinkOptions,
): UseMutationResult<
  t.TDeleteSharedLinkResponse,
  unknown,
  { shareId: string },
  t.DeleteSharedLinkContext
> => {
  const queryClient = useQueryClient();
  const { onSuccess } = options || {};

  return useMutation((vars) => dataService.deleteSharedLink(vars.shareId), {
    onMutate: async (vars) => {
      await queryClient.cancelQueries({
        queryKey: [QueryKeys.sharedLinks],
        exact: false,
      });

      const previousQueries = new Map();
      const queryKeys = queryClient.getQueryCache().findAll([QueryKeys.sharedLinks]);

      queryKeys.forEach((query) => {
        const previousData = queryClient.getQueryData(query.queryKey);
        previousQueries.set(query.queryKey, previousData);

        queryClient.setQueryData<t.SharedLinkQueryData>(query.queryKey, (old) => {
          if (!old?.pages) {
            return old;
          }

          const updatedPages = old.pages.map((page) => ({
            ...page,
            links: page.links.filter((link) => link.shareId !== vars.shareId),
          }));

          const nonEmptyPages = updatedPages.filter((page) => page.links.length > 0);

          return {
            ...old,
            pages: nonEmptyPages,
          };
        });
      });

      return { previousQueries };
    },

    onError: (_err, _vars, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach((prevData: unknown, prevQueryKey: unknown) => {
          queryClient.setQueryData(prevQueryKey as string[], prevData);
        });
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: [QueryKeys.sharedLinks],
        exact: false,
      });
    },

    onSuccess: (data, variables) => {
      if (onSuccess) {
        onSuccess(data, variables);
      }

      queryClient.refetchQueries({
        queryKey: [QueryKeys.sharedLinks],
        exact: true,
      });
    },
  });
};

// Add a tag or update tag information (tag, description, position, etc.)
export const useConversationTagMutation = ({
  context,
  tag,
  options,
}: {
  context: string;
  tag?: string;
  options?: t.UpdateConversationTagOptions;
}): UseMutationResult<t.TConversationTagResponse, unknown, t.TConversationTagRequest, unknown> => {
  const queryClient = useQueryClient();
  const { onSuccess, ..._options } = options || {};
  const onMutationSuccess: typeof onSuccess = (_data, vars) => {
    queryClient.setQueryData<t.TConversationTag[]>([QueryKeys.conversationTags], (queryData) => {
      if (!queryData) {
        return [
          {
            count: 1,
            position: 0,
            tag: Constants.SAVED_TAG,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ] as t.TConversationTag[];
      }
      if (tag === undefined || !tag.length) {
        // Check if the tag already exists
        const existingTagIndex = queryData.findIndex((item) => item.tag === _data.tag);
        if (existingTagIndex !== -1) {
          logger.log(
            'tag_mutation',
            `"Created" tag exists, updating from ${context}`,
            queryData,
            _data,
          );
          // If the tag exists, update it
          const updatedData = [...queryData];
          updatedData[existingTagIndex] = { ...updatedData[existingTagIndex], ..._data };
          return updatedData.sort((a, b) => a.position - b.position);
        } else {
          // If the tag doesn't exist, add it
          logger.log(
            'tag_mutation',
            `"Created" tag is new, adding from ${context}`,
            queryData,
            _data,
          );
          return [...queryData, _data].sort((a, b) => a.position - b.position);
        }
      }
      logger.log('tag_mutation', `Updating tag from ${context}`, queryData, _data);
      return updateConversationTag(queryData, vars, _data, tag);
    });
    if (vars.addToConversation === true && vars.conversationId != null && _data.tag) {
      const currentConvo = queryClient.getQueryData<t.TConversation>([
        QueryKeys.conversation,
        vars.conversationId,
      ]);
      if (!currentConvo) {
        return;
      }
      logger.log(
        'tag_mutation',
        `\`updateTagsInConversation\` Update from ${context}`,
        currentConvo,
      );
      updateTagsInConversation(vars.conversationId, [...(currentConvo.tags || []), _data.tag]);
    }
    // Change the tag title to the new title
    if (tag != null) {
      replaceTagsInAllConversations(tag, _data.tag);
    }
  };
  const { updateTagsInConversation, replaceTagsInAllConversations } = useUpdateTagsInConvo();
  return useMutation(
    (payload: t.TConversationTagRequest) =>
      tag != null
        ? dataService.updateConversationTag(tag, payload)
        : dataService.createConversationTag(payload),
    {
      onSuccess: (...args) => {
        onMutationSuccess(...args);
        onSuccess?.(...args);
      },
      ..._options,
    },
  );
};

// When a bookmark is deleted, remove that bookmark(tag) from all conversations associated with it
export const useDeleteTagInConversations = () => {
  const queryClient = useQueryClient();
  const deleteTagInAllConversation = (deletedTag: string) => {
    const data = queryClient.getQueryData<InfiniteData<ConversationListResponse>>([
      QueryKeys.allConversations,
    ]);

    const conversationIdsWithTag = [] as string[];

    // remove deleted tag from conversations
    const newData = JSON.parse(JSON.stringify(data)) as InfiniteData<ConversationListResponse>;
    for (let pageIndex = 0; pageIndex < newData.pages.length; pageIndex++) {
      const page = newData.pages[pageIndex];
      page.conversations = page.conversations.map((conversation) => {
        if (
          conversation.conversationId != null &&
          conversation.conversationId &&
          conversation.tags?.includes(deletedTag) === true
        ) {
          conversationIdsWithTag.push(conversation.conversationId);
          conversation.tags = conversation.tags.filter((t) => t !== deletedTag);
        }
        return conversation;
      });
    }
    queryClient.setQueryData<InfiniteData<ConversationListResponse>>(
      [QueryKeys.allConversations],
      newData,
    );

    // Remove the deleted tag from the cache of each conversation
    for (let i = 0; i < conversationIdsWithTag.length; i++) {
      const conversationId = conversationIdsWithTag[i];
      const conversationData = queryClient.getQueryData<t.TConversation>([
        QueryKeys.conversation,
        conversationId,
      ]);
      if (conversationData && conversationData.tags) {
        conversationData.tags = conversationData.tags.filter((t) => t !== deletedTag);
        queryClient.setQueryData<t.TConversation>(
          [QueryKeys.conversation, conversationId],
          conversationData,
        );
      }
    }
  };
  return deleteTagInAllConversation;
};
// Delete a tag
export const useDeleteConversationTagMutation = (
  options?: t.DeleteConversationTagOptions,
): UseMutationResult<t.TConversationTagResponse, unknown, string, void> => {
  const queryClient = useQueryClient();
  const deleteTagInAllConversations = useDeleteTagInConversations();

  const { onSuccess, ..._options } = options || {};

  return useMutation((tag: string) => dataService.deleteConversationTag(tag), {
    onSuccess: (_data, tagToDelete, context) => {
      queryClient.setQueryData<t.TConversationTag[]>([QueryKeys.conversationTags], (data) => {
        if (!data) {
          return data;
        }
        return data.filter((t) => t.tag !== tagToDelete);
      });

      deleteTagInAllConversations(tagToDelete);
      onSuccess?.(_data, tagToDelete, context);
    },
    ..._options,
  });
};

export const useDeleteConversationMutation = (
  options?: t.DeleteConversationOptions,
): UseMutationResult<
  t.TDeleteConversationResponse,
  unknown,
  t.TDeleteConversationRequest,
  unknown
> => {
  const queryClient = useQueryClient();
  const { refetch } = useConversationsInfiniteQuery();
  const { onSuccess, ..._options } = options || {};
  return useMutation(
    (payload: t.TDeleteConversationRequest) => dataService.deleteConversation(payload),
    {
      onSuccess: (_data, vars, context) => {
        const conversationId = vars.conversationId ?? '';
        if (!conversationId) {
          return;
        }

        const handleDelete = (convoData: t.ConversationData | undefined) => {
          if (!convoData) {
            return convoData;
          }
          return normalizeData(
            deleteConversation(convoData, conversationId),
            'conversations',
            Number(convoData.pages[0].pageSize),
          );
        };

        queryClient.setQueryData([QueryKeys.conversation, conversationId], null);
        queryClient.setQueryData<t.ConversationData>([QueryKeys.allConversations], handleDelete);
        queryClient.setQueryData<t.ConversationData>(
          [QueryKeys.archivedConversations],
          handleDelete,
        );
        const current = queryClient.getQueryData<t.ConversationData>([QueryKeys.allConversations]);
        refetch({ refetchPage: (page, index) => index === (current?.pages.length ?? 1) - 1 });
        onSuccess?.(_data, vars, context);
      },
      ..._options,
    },
  );
};

export const useDuplicateConversationMutation = (
  options?: t.DuplicateConvoOptions,
): UseMutationResult<t.TDuplicateConvoResponse, unknown, t.TDuplicateConvoRequest, unknown> => {
  const queryClient = useQueryClient();
  const { onSuccess, ..._options } = options ?? {};
  return useMutation((payload) => dataService.duplicateConversation(payload), {
    onSuccess: (data, vars, context) => {
      const originalId = vars.conversationId ?? '';
      if (originalId.length === 0) {
        return;
      }
      queryClient.setQueryData(
        [QueryKeys.conversation, data.conversation.conversationId],
        data.conversation,
      );
      queryClient.setQueryData<t.ConversationData>([QueryKeys.allConversations], (convoData) => {
        if (!convoData) {
          return convoData;
        }
        return addConversation(convoData, data.conversation);
      });
      queryClient.setQueryData<t.TMessage[]>(
        [QueryKeys.messages, data.conversation.conversationId],
        data.messages,
      );
      onSuccess?.(data, vars, context);
    },
    ..._options,
  });
};

export const useForkConvoMutation = (
  options?: t.ForkConvoOptions,
): UseMutationResult<t.TForkConvoResponse, unknown, t.TForkConvoRequest, unknown> => {
  const queryClient = useQueryClient();
  const { onSuccess, ..._options } = options || {};
  return useMutation((payload: t.TForkConvoRequest) => dataService.forkConversation(payload), {
    onSuccess: (data, vars, context) => {
      if (!vars.conversationId) {
        return;
      }
      queryClient.setQueryData(
        [QueryKeys.conversation, data.conversation.conversationId],
        data.conversation,
      );
      queryClient.setQueryData<t.ConversationData>([QueryKeys.allConversations], (convoData) => {
        if (!convoData) {
          return convoData;
        }
        return addConversation(convoData, data.conversation);
      });
      queryClient.setQueryData<t.TMessage[]>(
        [QueryKeys.messages, data.conversation.conversationId],
        data.messages,
      );
      onSuccess?.(data, vars, context);
    },
    ..._options,
  });
};

export const useUploadConversationsMutation = (
  _options?: t.MutationOptions<t.TImportResponse, FormData>,
) => {
  const queryClient = useQueryClient();
  const { onSuccess, onError, onMutate } = _options || {};

  return useMutation<t.TImportResponse, unknown, FormData>({
    mutationFn: (formData: FormData) => dataService.importConversationsFile(formData),
    onSuccess: (data, variables, context) => {
      /* TODO: optimize to return imported conversations and add manually */
      queryClient.invalidateQueries([QueryKeys.allConversations]);
      if (onSuccess) {
        onSuccess(data, variables, context);
      }
    },
    onError: (err, variables, context) => {
      if (onError) {
        onError(err, variables, context);
      }
    },
    onMutate,
  });
};

export const useUpdatePresetMutation = (
  options?: t.UpdatePresetOptions,
): UseMutationResult<
  t.TPreset, // response data
  unknown,
  t.TPreset,
  unknown
> => {
  return useMutation([MutationKeys.updatePreset], {
    mutationFn: (preset: t.TPreset) => dataService.updatePreset(preset),
    ...(options || {}),
  });
};

export const useDeletePresetMutation = (
  options?: t.DeletePresetOptions,
): UseMutationResult<
  t.PresetDeleteResponse, // response data
  unknown,
  t.TPreset | undefined,
  unknown
> => {
  return useMutation([MutationKeys.deletePreset], {
    mutationFn: (preset: t.TPreset | undefined) => dataService.deletePreset(preset),
    ...(options || {}),
  });
};

/* Avatar upload */
export const useUploadAvatarMutation = (
  options?: t.UploadAvatarOptions,
): UseMutationResult<
  t.AvatarUploadResponse, // response data
  unknown, // error
  FormData, // request
  unknown // context
> => {
  return useMutation([MutationKeys.avatarUpload], {
    mutationFn: (variables: FormData) => dataService.uploadAvatar(variables),
    ...(options || {}),
  });
};

/* Speech to text */
export const useSpeechToTextMutation = (
  options?: t.SpeechToTextOptions,
): UseMutationResult<
  t.SpeechToTextResponse, // response data
  unknown, // error
  FormData, // request
  unknown // context
> => {
  return useMutation([MutationKeys.speechToText], {
    mutationFn: (variables: FormData) => dataService.speechToText(variables),
    ...(options || {}),
  });
};

/* Text to speech */
export const useTextToSpeechMutation = (
  options?: t.TextToSpeechOptions,
): UseMutationResult<
  ArrayBuffer, // response data
  unknown, // error
  FormData, // request
  unknown // context
> => {
  return useMutation([MutationKeys.textToSpeech], {
    mutationFn: (variables: FormData) => dataService.textToSpeech(variables),
    ...(options || {}),
  });
};

/**
 * ASSISTANTS
 */

/**
 * Create a new assistant
 */
export const useCreateAssistantMutation = (
  options?: t.CreateAssistantMutationOptions,
): UseMutationResult<t.Assistant, Error, t.AssistantCreateParams> => {
  const queryClient = useQueryClient();
  return useMutation(
    (newAssistantData: t.AssistantCreateParams) => dataService.createAssistant(newAssistantData),
    {
      onMutate: (variables) => options?.onMutate?.(variables),
      onError: (error, variables, context) => options?.onError?.(error, variables, context),
      onSuccess: (newAssistant, variables, context) => {
        const listRes = queryClient.getQueryData<t.AssistantListResponse>([
          QueryKeys.assistants,
          variables.endpoint,
          defaultOrderQuery,
        ]);

        if (!listRes) {
          return options?.onSuccess?.(newAssistant, variables, context);
        }

        const currentAssistants = [newAssistant, ...JSON.parse(JSON.stringify(listRes.data))];

        queryClient.setQueryData<t.AssistantListResponse>(
          [QueryKeys.assistants, variables.endpoint, defaultOrderQuery],
          {
            ...listRes,
            data: currentAssistants,
          },
        );
        return options?.onSuccess?.(newAssistant, variables, context);
      },
    },
  );
};

/**
 * Hook for updating an assistant
 */
export const useUpdateAssistantMutation = (
  options?: t.UpdateAssistantMutationOptions,
): UseMutationResult<
  t.Assistant,
  Error,
  { assistant_id: string; data: t.AssistantUpdateParams }
> => {
  const queryClient = useQueryClient();
  return useMutation(
    ({ assistant_id, data }: { assistant_id: string; data: t.AssistantUpdateParams }) => {
      const { endpoint } = data;
      const endpointsConfig = queryClient.getQueryData<t.TEndpointsConfig>([QueryKeys.endpoints]);
      const endpointConfig = endpointsConfig?.[endpoint];
      const version = endpointConfig?.version ?? defaultAssistantsVersion[endpoint];
      return dataService.updateAssistant({
        data,
        version,
        assistant_id,
      });
    },
    {
      onMutate: (variables) => options?.onMutate?.(variables),
      onError: (error, variables, context) => options?.onError?.(error, variables, context),
      onSuccess: (updatedAssistant, variables, context) => {
        const listRes = queryClient.getQueryData<t.AssistantListResponse>([
          QueryKeys.assistants,
          variables.data.endpoint,
          defaultOrderQuery,
        ]);

        if (!listRes) {
          return options?.onSuccess?.(updatedAssistant, variables, context);
        }

        queryClient.setQueryData<t.AssistantDocument[]>(
          [QueryKeys.assistantDocs, variables.data.endpoint],
          (prev) => {
            if (!prev) {
              return prev;
            }
            return prev.map((doc) => {
              if (doc.assistant_id === variables.assistant_id) {
                return {
                  ...doc,
                  conversation_starters: updatedAssistant.conversation_starters,
                  append_current_datetime: variables.data.append_current_datetime,
                };
              }
              return doc;
            });
          },
        );

        queryClient.setQueryData<t.AssistantListResponse>(
          [QueryKeys.assistants, variables.data.endpoint, defaultOrderQuery],
          {
            ...listRes,
            data: listRes.data.map((assistant) => {
              if (assistant.id === variables.assistant_id) {
                return updatedAssistant;
              }
              return assistant;
            }),
          },
        );
        return options?.onSuccess?.(updatedAssistant, variables, context);
      },
    },
  );
};

/**
 * Hook for deleting an assistant
 */
export const useDeleteAssistantMutation = (
  options?: t.DeleteAssistantMutationOptions,
): UseMutationResult<void, Error, t.DeleteAssistantBody> => {
  const queryClient = useQueryClient();
  return useMutation(
    ({ assistant_id, model, endpoint }: t.DeleteAssistantBody) => {
      const endpointsConfig = queryClient.getQueryData<t.TEndpointsConfig>([QueryKeys.endpoints]);
      const version = endpointsConfig?.[endpoint]?.version ?? defaultAssistantsVersion[endpoint];
      return dataService.deleteAssistant({ assistant_id, model, version, endpoint });
    },
    {
      onMutate: (variables) => options?.onMutate?.(variables),
      onError: (error, variables, context) => options?.onError?.(error, variables, context),
      onSuccess: (_data, variables, context) => {
        const listRes = queryClient.getQueryData<t.AssistantListResponse>([
          QueryKeys.assistants,
          variables.endpoint,
          defaultOrderQuery,
        ]);

        if (!listRes) {
          return options?.onSuccess?.(_data, variables, context);
        }

        const data = listRes.data.filter((assistant) => assistant.id !== variables.assistant_id);

        queryClient.setQueryData<t.AssistantListResponse>(
          [QueryKeys.assistants, variables.endpoint, defaultOrderQuery],
          {
            ...listRes,
            data,
          },
        );

        return options?.onSuccess?.(_data, variables, data);
      },
    },
  );
};

/**
 * Hook for uploading an assistant avatar
 */
export const useUploadAssistantAvatarMutation = (
  options?: t.UploadAssistantAvatarOptions,
): UseMutationResult<
  t.Assistant, // response data
  unknown, // error
  t.AssistantAvatarVariables, // request
  unknown // context
> => {
  return useMutation([MutationKeys.assistantAvatarUpload], {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mutationFn: ({ postCreation, ...variables }: t.AssistantAvatarVariables) =>
      dataService.uploadAssistantAvatar(variables),
    ...(options || {}),
  });
};

/**
 * Hook for updating Assistant Actions
 */
export const useUpdateAction = (
  options?: t.UpdateActionOptions,
): UseMutationResult<
  t.UpdateActionResponse, // response data
  unknown, // error
  t.UpdateActionVariables, // request
  unknown // context
> => {
  const queryClient = useQueryClient();
  return useMutation([MutationKeys.updateAction], {
    mutationFn: (variables: t.UpdateActionVariables) => dataService.updateAction(variables),

    onMutate: (variables) => options?.onMutate?.(variables),
    onError: (error, variables, context) => options?.onError?.(error, variables, context),
    onSuccess: (updateActionResponse, variables, context) => {
      const listRes = queryClient.getQueryData<t.AssistantListResponse>([
        QueryKeys.assistants,
        variables.endpoint,
        defaultOrderQuery,
      ]);

      if (!listRes) {
        return options?.onSuccess?.(updateActionResponse, variables, context);
      }

      const updatedAssistant = updateActionResponse[1];

      queryClient.setQueryData<t.AssistantListResponse>(
        [QueryKeys.assistants, variables.endpoint, defaultOrderQuery],
        {
          ...listRes,
          data: listRes.data.map((assistant) => {
            if (assistant.id === variables.assistant_id) {
              return updatedAssistant;
            }
            return assistant;
          }),
        },
      );

      queryClient.setQueryData<t.Action[]>([QueryKeys.actions], (prev) => {
        return prev
          ?.map((action) => {
            if (action.action_id === variables.action_id) {
              return updateActionResponse[2];
            }
            return action;
          })
          .concat(
            variables.action_id != null && variables.action_id ? [] : [updateActionResponse[2]],
          );
      });

      return options?.onSuccess?.(updateActionResponse, variables, context);
    },
  });
};

/**
 * Hook for deleting an Assistant Action
 */
export const useDeleteAction = (
  options?: t.DeleteActionOptions,
): UseMutationResult<
  void, // response data for a delete operation is typically void
  Error, // error type
  t.DeleteActionVariables, // request variables
  unknown // context
> => {
  const queryClient = useQueryClient();
  return useMutation([MutationKeys.deleteAction], {
    mutationFn: (variables: t.DeleteActionVariables) => {
      const { endpoint } = variables;
      const endpointsConfig = queryClient.getQueryData<t.TEndpointsConfig>([QueryKeys.endpoints]);
      const version = endpointsConfig?.[endpoint]?.version ?? defaultAssistantsVersion[endpoint];
      return dataService.deleteAction({
        ...variables,
        version,
      });
    },

    onMutate: (variables) => options?.onMutate?.(variables),
    onError: (error, variables, context) => options?.onError?.(error, variables, context),
    onSuccess: (_data, variables, context) => {
      let domain: string | undefined = '';
      queryClient.setQueryData<t.Action[]>([QueryKeys.actions], (prev) => {
        return prev?.filter((action) => {
          domain = action.metadata.domain;
          return action.action_id !== variables.action_id;
        });
      });

      queryClient.setQueryData<t.AssistantListResponse>(
        [QueryKeys.assistants, variables.endpoint, defaultOrderQuery],
        (prev) => {
          if (!prev) {
            return prev;
          }

          return {
            ...prev,
            data: prev.data.map((assistant) => {
              if (assistant.id === variables.assistant_id) {
                return {
                  ...assistant,
                  tools: (assistant.tools ?? []).filter(
                    (tool) => !(tool.function?.name.includes(domain ?? '') ?? false),
                  ),
                };
              }
              return assistant;
            }),
          };
        },
      );

      return options?.onSuccess?.(_data, variables, context);
    },
  });
};

/**
 * Hook for verifying email address
 */
export const useVerifyEmailMutation = (
  options?: t.VerifyEmailOptions,
): UseMutationResult<t.VerifyEmailResponse, unknown, t.TVerifyEmail, unknown> => {
  return useMutation({
    mutationFn: (variables: t.TVerifyEmail) => dataService.verifyEmail(variables),
    ...(options || {}),
  });
};

/**
 * Hook for resending verficiation email
 */
export const useResendVerificationEmail = (
  options?: t.ResendVerifcationOptions,
): UseMutationResult<t.VerifyEmailResponse, unknown, t.TResendVerificationEmail, unknown> => {
  return useMutation({
    mutationFn: (variables: t.TResendVerificationEmail) =>
      dataService.resendVerificationEmail(variables),
    ...(options || {}),
  });
};

export const useAcceptTermsMutation = (
  options?: t.AcceptTermsMutationOptions,
): UseMutationResult<t.TAcceptTermsResponse, unknown, void, unknown> => {
  const queryClient = useQueryClient();
  return useMutation(() => dataService.acceptTerms(), {
    onSuccess: (data, variables, context) => {
      queryClient.setQueryData<t.TUserTermsResponse>([QueryKeys.userTerms], {
        termsAccepted: true,
      });
      options?.onSuccess?.(data, variables, context);
    },
    onError: options?.onError,
    onMutate: options?.onMutate,
  });
};
