export type Provider = {
  id: string;
  name: string;
  slug: string;
  avg_rating: number;
  companies: {
    name: string;
    logo_url: string | null;
  } | null;
};

export type Model = {
  id: string;
  name: string;
  slug: string;
  token_count: string;
  status: string;
  description: string | null;
  highlights: string[];
  rank_order: number | null;
  providers: Provider | null;
};

export type Product = {
  id: string;
  name: string;
  token_limit: number | null;
  call_rate_rpm: number | null;
  audience: string | null;
  billing_rate: string | null;
  capabilities: string[];
};

export type Review = {
  id: string;
  author_name: string | null;
  rating: number;
  content: string | null;
  created_at: string;
};

export type ModelDetail = Model & {
  documentation_url: string | null;
  output_examples: { prompt: string; output: string }[];
  products: Product[];
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
