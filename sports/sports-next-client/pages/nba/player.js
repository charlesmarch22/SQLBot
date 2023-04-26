import { PlayerPage } from "@/components/nba/game_data/player_page";
import { useRouter } from "next/router";

const Player = () => {
  const router = useRouter();
  const { id } = router.query;

  console.log("id: ", id);

  return <PlayerPage />;
};

export default Player;