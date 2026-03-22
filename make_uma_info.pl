use strict;
use warnings;
use v5.28;
use utf8;

use Cwd 'abs_path';
use File::Basename;
use File::Copy;
use File::Slurper 'read_binary';
use DBI;
use DBD::SQLite::Constants qw(:file_open);  # requires custom DBD::SQLite; see note in extract_resource.pl
use JSON::PP;

use lib dirname(abs_path(__FILE__));
use AssetExtractor qw($db_key extract_asset);

use Encode qw(encode decode);
# NONE OF THIS SHIT WORKS
# I HAVE TRIED EVERY COMBINATION OF binmode(), use open qw(:std :utf8), OutputCP(), etc etc
# PROBABLY IT WORKS ON NORMAL WINDOWS BUT MY LOCALE IS SET TO JAPAN
# THE ONLY THING THAT WORKS IS encode('cp932', decode('utf8', $str))
#binmode(STDOUT, ':encoding(utf8)');
#use Win32::Console;
#Win32::Console::OutputCP(65001);

if (!@ARGV) {
	die 'Usage: make_uma_info.pl master.mdb';
}

my $mastermdb = shift @ARGV;
my $root = dirname(dirname(abs_path($mastermdb)));
my $meta = $root . "./meta";
my $datadir = $root . "/dat";

my $umas = decode_json(read_binary('umas.json'));
my $icons = decode_json(read_binary('icons.json'));

# temporary: for importing english names from the old icons file
my $en_icons = decode_json(read_binary('umadle/icons.json'));
my %en_names;
for my $en (keys %$en_icons) {
	my $path = $en_icons->{$en};
	$path =~ /chr_icon_(\d+)\.png/;
	my $id = $1;
	$en_names{$id} = $en;
}

my $db = DBI->connect("dbi:SQLite:$mastermdb", undef, undef, {
	sqlite_open_flags => SQLITE_OPEN_READONLY
});
$db->{RaiseError} = 1;

my $select_umas = $db->prepare('SELECT [index], text FROM text_data WHERE category = 6 AND [index] < 2000;');
my $select_outfits = $db->prepare('SELECT [index], text FROM text_data WHERE category = 5 AND [index] BETWEEN (?1 * 100) AND ((?1 + 1) * 100) ORDER BY [index] ASC;');

my $APTITUDES = q(
	cr.proper_distance_short, cr.proper_distance_mile, cr.proper_distance_middle, cr.proper_distance_long,
	cr.proper_running_style_nige, cr.proper_running_style_senko, cr.proper_running_style_sashi, cr.proper_running_style_oikomi,
	cr.proper_ground_turf, cr.proper_ground_dirt
);
my $select_outfit_data = $db->prepare("
    SELECT c.default_rarity, c.running_style, json_array($APTITUDES), json_group_array(ss.skill_id)
      FROM card_data c
INNER JOIN available_skill_set ss
        ON c.available_skill_set_id = ss.available_skill_set_id
INNER JOIN (SELECT card_id, $APTITUDES FROM card_rarity_data cr GROUP BY card_id) cr
        ON c.id = cr.card_id
     WHERE c.id = ?1
  GROUP BY ss.available_skill_set_id;
");

my $metadb = DBI->connect("dbi:SQLite:$meta", undef, undef, {
	sqlite_open_flags => SQLITE_OPEN_READONLY
});
$metadb->{RaiseError} = 1;

$metadb->do('PRAGMA cipher = "chacha20";');
$metadb->do("PRAGMA hexkey = \"$db_key\";");

my $select_chara_icon = $metadb->prepare('SELECT n, h, e FROM a WHERE n LIKE ("%/chr_icon_" || ?);');

# for some bizarre reason the icon ids for alts arent always the same as the category 5 ids in text_data (sometimes they are!)
# select all of them and rely on ordering by rowid to sort things out for us.
my $select_trained_icon = $metadb->prepare('SELECT n, h, e FROM a WHERE n LIKE ("%/trained_chr_icon_" || ?1 || "_" || ?1 || "%") AND (n LIKE "%_01" OR n LIKE "%_02") ORDER BY rowid;');

$select_umas->execute;

$select_umas->bind_columns(\my ($id, $ja_name));

while ($select_umas->fetch) {
	if (!$umas->{$id}) {
		$select_chara_icon->execute($id);
		$select_chara_icon->bind_columns(\my ($icon_path, $icon_hash, $icon_keyint));
		$select_chara_icon->fetch;

		my $en_name = $en_names{$id};
		if (!$en_name) {
			my $haha_perl_windows_unicode_memes_lolxd = Encode::encode('cp932', Encode::decode('utf8', $ja_name));
			print "English name for $haha_perl_windows_unicode_memes_lolxd => ";
			$en_name = <STDIN>;
			chomp $en_name;
		}
		$umas->{$id} = {name => [Encode::decode('utf8', $ja_name), $en_name], outfits => {}};
		my $base = basename($icon_path);  # tehe
		$icons->{$id} = $base;

		extract_asset($datadir, $icon_hash, $icon_keyint);
	}
	my @outfit_ids;
	$select_outfits->execute($id);
	$select_outfits->bind_columns(\my ($o_id, $epithet));
	while ($select_outfits->fetch) {
		push @outfit_ids, $o_id;
		$select_outfit_data->execute($o_id);
		$select_outfit_data->bind_columns(\my ($default_rarity, $running_style, $aptitudes, $awakenings));
		$select_outfit_data->fetch;
		$umas->{$id}->{outfits}->{$o_id} = {
			epithet => Encode::decode('utf8', $epithet),
			rarity => $default_rarity,
			strategy => $running_style,
			aptitudes => decode_json($aptitudes),
			awakenings => [map { "$_" } @{decode_json($awakenings)}]
		};
	}

	next unless @outfit_ids;
	$select_trained_icon->execute($id);
	$select_trained_icon->bind_columns(\my ($icon_path, $icon_hash, $icon_keyint));
	my $i = 0;
	while ($select_trained_icon->fetch) {
		if (defined $icons->{$outfit_ids[$i]}) {
			$select_trained_icon->fetch;  # advance
			++$i;
			next;
		}
		my $base1 = basename($icon_path);
		extract_asset($datadir, $icon_hash, $icon_keyint);
		# icons come in pairs (_01 and _02), fetch the next
		$select_trained_icon->fetch;
		my $base2 = basename($icon_path);
		extract_asset($datadir, $icon_hash, $icon_keyint);
		$icons->{$outfit_ids[$i++]} = [$base1, $base2];
	}
}

my $json = JSON::PP->new;
$json->canonical(1);
$json->utf8(1);
open(my $umas_fh, '>', 'umas.json');
print $umas_fh $json->encode($umas);
close $umas_fh;
open(my $icons_fh, '>', 'icons.json');
print $icons_fh $json->encode($icons);
close $icons_fh;
