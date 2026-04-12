export type Provider = {
  id: string;
  name: string;
  slug: string;
  avg_rating: number;
  total_reviews?: number;
  companies: {
    name: string;
    logo_url: string | null;
  } | null;
};

export type Model = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  highlights: string[];
  rank_order: number | null;
  avg_rating?: number;
  total_reviews?: number;
  type_of_ai?: string | null;
  parameters?: string | null;
  layers?: number | null;
  gb_size?: number | null;
  input_price_per_million_cents?: number | null;
  output_price_per_million_cents?: number | null;
  providers: Provider | null;
};

export type Review = {
  model_id: string;
  comment_id: string;
  user_id?: string;
  author_name: string | null;
  rating: number;
  content: string | null;
  created_at: string;
};

export type ReviewWithOwnership = Review & {
  isOwner: boolean;
};

export type ModelDetail = Model & {
  api_docs: string | null;
  reviews: Review[];
  providers: (Provider & {
    companies: {
      id: string;
      name: string;
      logo_url: string | null;
      website: string | null;
    } | null;
  }) | null;
};
